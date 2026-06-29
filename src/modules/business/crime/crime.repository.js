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

    // Map involved officers
    if (Array.isArray(dto.officer_ids) && dto.officer_ids.length > 0) {
      const ioTable = getTable(req, env.TABLE_INCIDENT_OFFICER);
      for (const oid of dto.officer_ids) {
        await ioTable.insertRow({ incident_id: saved.ROWID, officer_id: oid });
      }
    }

    return { id: saved.ROWID };
  },

  async addCrimesBulk(dtos, req) {
    if (!Array.isArray(dtos) || dtos.length === 0) {
      throw new Error('dtos must be a non-empty array');
    }
    
    const table = getTable(req, env.TABLE_CRIME_INCIDENT);
    
    const rowsToInsert = dtos.map(dto => ({
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
    }));

    const BATCH_SIZE = 200;
    const insertedIds = [];
    
    for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
      const chunk = rowsToInsert.slice(i, i + BATCH_SIZE);
      const savedChunk = await table.insertRows(chunk);
      insertedIds.push(...savedChunk.map(r => r.ROWID));
    }

    return { message: `${insertedIds.length} crimes inserted successfully`, ids: insertedIds };
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
