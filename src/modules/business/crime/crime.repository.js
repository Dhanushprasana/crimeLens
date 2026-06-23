'use strict';

const env = require('../../../config/env');

async function executeQuery(req, query) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  const zcql = req.catalyst.zcql();
  return zcql.executeZCQLQuery(query);
}

function getTable(req, name) { if (!req.catalyst) throw new Error('Catalyst SDK not initialized'); return req.catalyst.datastore().table(name); }

module.exports = {
  async addCrime(dto, req) {
    const table = getTable(req, env.TABLE_CRIME_INCIDENT);
    const row = {
      crime_number: dto.crime_number || null,
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

    // Map involved criminals
    let genders = [];
    if (Array.isArray(dto.criminal_ids) && dto.criminal_ids.length > 0) {
      const icTable = getTable(req, env.TABLE_INCIDENT_CRIMINAL);
      for (const cid of dto.criminal_ids) {
        await icTable.insertRow({ incident_id: saved.ROWID, criminal_id: cid });
        // fetch gender
        try {
          const crimRows = await executeQuery(req, `SELECT gender FROM ${env.TABLE_CRIMINAL} WHERE ROWID = '${cid}'`);
          if (crimRows && crimRows.length > 0) {
            const rec = crimRows[0][env.TABLE_CRIMINAL] || crimRows[0];
            genders.push(rec.gender || 'Unknown');
          } else {
            genders.push('Unknown');
          }
        } catch (e) {
          genders.push('Unknown');
        }
      }
    } else {
      genders.push('Unknown');
    }

    // Incremental update of statistics
    const district_id = dto.crime_happended_at_district_id;
    const police_station_id = dto.police_station_id;
    const crime_category_id = dto.crime_category_id;
    let incident_registered_date = dto.incident_registered_date ? dto.incident_registered_date.split(' ')[0].split('T')[0] : null;
    if (!incident_registered_date) incident_registered_date = new Date().toISOString().split('T')[0];

    if (district_id && police_station_id && crime_category_id) {
      const statsTable = getTable(req, env.TABLE_COMP_DISTRICT_CRIME_STATS);
      try {
        const checkQuery = `SELECT ROWID, crime_count FROM ${env.TABLE_COMP_DISTRICT_CRIME_STATS} WHERE district_id = '${district_id}' AND police_station_id = '${police_station_id}' AND crime_category_id = '${crime_category_id}' AND incident_registered_date = '${incident_registered_date}'`;
        const existing = await executeQuery(req, checkQuery);
        if (existing && existing.length > 0) {
          const statRow = existing[0][env.TABLE_COMP_DISTRICT_CRIME_STATS] || existing[0];
          const newCount = (parseInt(statRow.crime_count || 0, 10) + 1);
          await statsTable.updateRow({ ROWID: statRow.ROWID, crime_count: newCount });
        } else {
          await statsTable.insertRow({ district_id, police_station_id, crime_category_id, incident_registered_date, crime_count: 1 });
        }
      } catch (e) {
        console.error("Incremental stat update failed", e.message || e);
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

  async getAllCrimes(query, req) {
    const sql = `SELECT * FROM ${env.TABLE_CRIME_INCIDENT}`;
    const res = await executeQuery(req, sql);
    return res.map(r => r[env.TABLE_CRIME_INCIDENT]);
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
};
