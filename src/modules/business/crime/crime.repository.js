'use strict';

const env = require('../../../config/env');

async function executeQuery(req, query) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  const zcql = req.catalyst.zcql();
  return zcql.executeZCQLQuery(query);
}

function getTable(req, name) { if (!req.catalyst) throw new Error('Catalyst SDK not initialized'); return req.catalyst.datastore().table(name); }

async function generateCrimeAndCaseNumbers(dto, req) {
  let categoryCode = '1';
  if (dto.crime_category_id) {
    try {
      const safeId = String(dto.crime_category_id).replace(/'/g, "''");
      const catQuery = `SELECT crime_category_number FROM ${env.TABLE_CRIME_CATEGORY} WHERE ROWID = '${safeId}'`;
      const catRes = await executeQuery(req, catQuery);
      if (catRes && catRes.length > 0) {
        const code = catRes[0][env.TABLE_CRIME_CATEGORY].crime_category_number;
        if (code) {
          categoryCode = String(code);
        }
      }
    } catch (err) {
      console.error('Error fetching category code:', err.message);
    }
  }

  const distStr = String(dto.crime_happended_at_district_id || '0000');
  const distId4 = distStr.length >= 4 ? distStr.slice(-4) : distStr.padStart(4, '0');

  const psStr = String(dto.police_station_id || '0000');
  const psId4 = psStr.length >= 4 ? psStr.slice(-4) : psStr.padStart(4, '0');

  let year = new Date().getFullYear().toString();
  if (dto.incident_registered_date) {
    const d = new Date(dto.incident_registered_date);
    if (!isNaN(d.getTime())) {
      year = d.getFullYear().toString();
    }
  }

  const prefix = `${categoryCode}${distId4}${psId4}${year}`;

  let maxSerial = 0;
  if (dto.police_station_id) {
    const safePs = String(dto.police_station_id).replace(/'/g, "''");
    const query = `SELECT crime_number FROM ${env.TABLE_CRIME_INCIDENT} WHERE police_station_id = '${safePs}' AND crime_number LIKE '${prefix}%'`;
    try {
      const existing = await executeQuery(req, query);
      for (const row of existing) {
        const cn = row[env.TABLE_CRIME_INCIDENT].crime_number;
        if (cn && cn.startsWith(prefix) && cn.length === 18) {
          const serial = parseInt(cn.slice(-5), 10);
          if (!isNaN(serial) && serial > maxSerial) {
            maxSerial = serial;
          }
        }
      }
    } catch (err) {
      console.error('Error fetching max serial for crime_number:', err.message);
    }
  }

  const nextSerialStr = (maxSerial + 1).toString().padStart(5, '0');
  return {
    crime_number: `${prefix}${nextSerialStr}`,
    case_number: `${year}${nextSerialStr}`
  };
}

module.exports = {
  async addCrime(dto, req) {
    // Auto-generate numbers if not provided
    let cNum = dto.crime_number || null;
    let caseNum = dto.case_number || null;
    if (!cNum || !caseNum) {
      const generated = await generateCrimeAndCaseNumbers(dto, req);
      cNum = cNum || generated.crime_number;
      caseNum = caseNum || generated.case_number;
    }

    const table = getTable(req, env.TABLE_CRIME_INCIDENT);
    const row = {
      crime_number: cNum,
      case_number: caseNum,
      title: dto.title,
      description: dto.description || null,
      crime_category_id: dto.crime_category_id || null,
      police_station_id: dto.police_station_id || null,
      crime_happended_at_district_id: dto.crime_happended_at_district_id || null,
      crime_location_latitude: dto.crime_location_latitude || null,
      crime_location_longitude: dto.crime_location_longitude || null,
      status: dto.status || 'UNDER_INVESTIGATION',
      crime_occured_date_time: dto.crime_occured_date_time || null,
      incident_registered_date: dto.incident_registered_date || null,
      fir_id: dto.fir_id || null,
      created_by: dto.created_by || null
    };
    const saved = await table.insertRow(row);

    // Handle evidences array
    if (Array.isArray(dto.evidences) && dto.evidences.length > 0) {
      const evidenceTable = getTable(req, env.TABLE_CRIME_EVIDENCE);
      for (const ev of dto.evidences) {
        await evidenceTable.insertRow({ incident_id: saved.ROWID, uploaded_by: ev.uploaded_by || null, evidence_type: ev.evidence_type || null, file_url: ev.file_url || null, description: ev.description || null, evidence_number: ev.evidence_number || null });
      }
    }

    // Map involved officers
    if (Array.isArray(dto.officer_ids) && dto.officer_ids.length > 0) {
      const ioTable = getTable(req, env.TABLE_INCIDENT_OFFICER);
      for (const oid of dto.officer_ids) {
        await ioTable.insertRow({ incident_id: saved.ROWID, officer_id: oid });
      }
    }

    return { id: saved.ROWID };
  },

  async getAllCrimes(params, req) {
    const TABLE = env.TABLE_CRIME_INCIDENT;

    // --- Allowed sort columns (whitelist to prevent SQL injection) ---
    const ALLOWED_SORT = new Set([
      'crime_occured_date_time',
      'createdtime',
      'crime_number',
      'status'
    ]);
    const sortBy    = ALLOWED_SORT.has(params.sortBy) ? params.sortBy : 'crime_occured_date_time';
    const sortOrder = params.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // --- Build WHERE conditions ---
    const conditions = [];

    const districtId = params.districtId || params.district_id || null;
    const stationId = params.stationId || params.station_id || null;
    const safeDistrictId = districtId
      ? String(districtId).replace(/'/g, "''")
      : null;
    const safeStationId = stationId
      ? String(stationId).replace(/'/g, "''")
      : null;

    if (params.search) {
      // Escape single quotes in the search term
      const safe = params.search.replace(/'/g, "''");
      conditions.push(
        `(crime_number LIKE '%${safe}%' OR title LIKE '%${safe}%' OR description LIKE '%${safe}%')`
      );
    }

    if (safeDistrictId) {
      conditions.push(`crime_happended_at_district_id = '${safeDistrictId}'`);
    }

    if (safeStationId) {
      conditions.push(`police_station_id = '${safeStationId}'`);
    }

    if (params.categoryId) {
      conditions.push(`crime_category_id = '${params.categoryId}'`);
    }

    if (params.status) {
      const safeStatus = params.status.replace(/'/g, "''");
      conditions.push(`status = '${safeStatus}'`);
    }

    // Exact single date: matches any time on that calendar day
    if (params.date) {
      conditions.push(`crime_occured_date_time >= '${params.date} 00:00:00' AND crime_occured_date_time <= '${params.date} 23:59:59'`);
    } else {
      // Date range (from / to are independent of each other)
      if (params.from) {
        conditions.push(`crime_occured_date_time >= '${params.from} 00:00:00'`);
      }
      if (params.to) {
        conditions.push(`crime_occured_date_time <= '${params.to} 23:59:59'`);
      }
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    // --- Projected SELECT columns (description excluded — heavy text not needed for list view) ---
    const selectedColumns = [
      'ROWID',
      'crime_number',
      'title',
      'crime_category_id',
      'police_station_id',
      'crime_happended_at_district_id',
      'crime_location_latitude',
      'crime_location_longitude',
      'status',
      'crime_occured_date_time',
      'incident_registered_date',
      'fir_id',
      'created_by',
      'createdtime',
      'modifiedtime',
      'case_number'
    ].join(', ');

    const offset = (params.page - 1) * params.pageSize;

    // --- COUNT query ---
    // ZCQL does NOT support COUNT(*). Must use a real column name.
    // ROWID is always present on every row, so COUNT(ROWID) gives the total row count.
    const countSql = `SELECT COUNT(ROWID) FROM ${TABLE}${whereClause}`;

    // --- Data query ---
    // ZCQL pagination syntax: LIMIT <pageSize> OFFSET <offset>  (confirmed in this repo)
    const dataSql =
      `SELECT ${selectedColumns} FROM ${TABLE}${whereClause}` +
      ` ORDER BY ${sortBy} ${sortOrder}` +
      ` LIMIT ${params.pageSize} OFFSET ${offset}`;

    // Run both queries in parallel
    const [countRes, dataRes] = await Promise.all([
      executeQuery(req, countSql),
      executeQuery(req, dataSql)
    ]);

    // --- Parse COUNT result ---
    // ZCQL returns: [{ "<TableName>": { "COUNT(ROWID)": "42" } }]
    // Fallback to Object.values()[0] in case the key shape differs across ZCQL parser versions.
    const firstCount = countRes[0] ? (countRes[0][TABLE] || countRes[0]) : {};
    const totalRecords = parseInt(
      firstCount['COUNT(ROWID)'] ||
      Object.values(firstCount)[0] ||
      0,
      10
    );

    const data = dataRes.map(r => r[TABLE] || r);

    // --- Build pagination metadata ---
    const totalPages = totalRecords > 0 ? Math.ceil(totalRecords / params.pageSize) : 0;
    return {
      data,
      pagination: {
        page:          params.page,
        pageSize:      params.pageSize,
        totalRecords,
        totalPages,
        hasNext:       params.page < totalPages,
        hasPrevious:   params.page > 1
      }
    };
  },
  async addCrimesBulk(dtos, req) {
    if (!Array.isArray(dtos) || dtos.length === 0) {
      throw new Error('dtos must be a non-empty array');
    }
    
    const table = getTable(req, env.TABLE_CRIME_INCIDENT);
    
    const rowsToInsert = [];
    for (const dto of dtos) {
      let cNum = dto.crime_number || null;
      let caseNum = dto.case_number || null;
      if (!cNum || !caseNum) {
        const generated = await generateCrimeAndCaseNumbers(dto, req);
        cNum = cNum || generated.crime_number;
        caseNum = caseNum || generated.case_number;
      }
      
      rowsToInsert.push({
        crime_number: cNum,
        case_number: caseNum,
      title: dto.title,
      description: dto.description || null,
      crime_category_id: dto.crime_category_id || null,
      police_station_id: dto.police_station_id || null,
      crime_happended_at_district_id: dto.crime_happended_at_district_id || null,
        crime_location_latitude: dto.crime_location_latitude || null,
        crime_location_longitude: dto.crime_location_longitude || null,
        status: dto.status || 'UNDER_INVESTIGATION',
        crime_occured_date_time: dto.crime_occured_date_time || null,
        incident_registered_date: dto.incident_registered_date || null,
        fir_id: dto.fir_id || null,
        created_by: dto.created_by || null
      });
    }

    const BATCH_SIZE = 200;
    const insertedIds = [];
    
    for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
      const chunk = rowsToInsert.slice(i, i + BATCH_SIZE);
      const savedChunk = await table.insertRows(chunk);
      insertedIds.push(...savedChunk.map(r => r.ROWID));
    }

    return { message: `${insertedIds.length} crimes inserted successfully`, ids: insertedIds };
  },


  async getOneCrime(id, req) {
    const sql = `SELECT * FROM ${env.TABLE_CRIME_INCIDENT} WHERE ROWID = '${id}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) throw new Error('Crime not found');
    const incident = res[0][env.TABLE_CRIME_INCIDENT];

    // fetch evidences
    const evSql = `SELECT * FROM ${env.TABLE_CRIME_EVIDENCE} WHERE incident_id = '${id}'`;
    const evRes = await executeQuery(req, evSql);
    incident.evidences = evRes.map(e => e[env.TABLE_CRIME_EVIDENCE]);

    return incident;
  },

  async updateCrime(id, dto, req) {
    const table = getTable(req, env.TABLE_CRIME_INCIDENT);
    const updateObj = Object.assign({ ROWID: id }, dto);
    await table.updateRow(updateObj);

    // Replace evidences if provided
    if (Array.isArray(dto.evidences)) {
      const evidenceTable = getTable(req, env.TABLE_CRIME_EVIDENCE);
      const evQuery = `SELECT ROWID FROM ${env.TABLE_CRIME_EVIDENCE} WHERE incident_id = '${id}'`;
      const evRows = await executeQuery(req, evQuery);
      for (const r of evRows) {
        await evidenceTable.deleteRow(r[env.TABLE_CRIME_EVIDENCE].ROWID);
      }
      for (const ev of dto.evidences) {
        await evidenceTable.insertRow({ incident_id: id, uploaded_by: ev.uploaded_by || null, evidence_type: ev.evidence_type || null, file_url: ev.file_url || null, description: ev.description || null, evidence_number: ev.evidence_number || null });
      }
    }

    return { message: 'Crime updated' };
  },

  async deleteCrime(id, req) {
    const table = getTable(req, env.TABLE_CRIME_INCIDENT);
    await table.deleteRow(id);
    return { message: 'Crime deleted' };
  }
}
