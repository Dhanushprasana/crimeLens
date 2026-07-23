'use strict';

const env = require('../../../config/env');

async function executeQuery(req, query) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  const zcql = req.catalyst.zcql();
  return zcql.executeZCQLQuery(query);
}

function getTable(req, name) { if (!req.catalyst) throw new Error('Catalyst SDK not initialized'); return req.catalyst.datastore().table(name); }

module.exports = {
  async addCriminal(dto, req) {
    const table = getTable(req, env.TABLE_CRIMINAL);
    const row = {
      criminal_number: dto.criminal_number || null,
      full_name: dto.full_name,
      gender: dto.gender || null,
      date_of_birth: dto.date_of_birth || null,
      nationality: dto.nationality || null,
      photo_url: dto.photo_url || null,
      status: dto.status || 'ACTIVE',
      address: dto.address || null,
      district_id_of_criminal: dto.district_id_of_criminal || null
    };
    const saved = await table.insertRow(row);
    return { id: saved.ROWID };
  },

  async getAllCriminals(query, req) {
    const districtId = query?.districtId || query?.district_id || null;
    const stationId = query?.stationId || query?.station_id || null;

    const safeDistrictId = districtId
      ? String(districtId).replace(/'/g, "''")
      : null;
    const safeStationId = stationId
      ? String(stationId).replace(/'/g, "''")
      : null;

    const conditions = [];

    if (safeDistrictId) {
      conditions.push(
        `${env.TABLE_CRIMINAL}.district_id_of_criminal = '${safeDistrictId}'`,
      );
    }

    if (safeStationId) {
      conditions.push(
        `${env.TABLE_CRIME_INCIDENT}.police_station_id = '${safeStationId}'`,
      );
    }

    const whereClause =
      conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

    let sql;

    if (safeStationId) {
      sql = `
        SELECT DISTINCT ${env.TABLE_CRIMINAL}.*
        FROM ${env.TABLE_CRIMINAL}
        INNER JOIN ${env.TABLE_INCIDENT_CRIMINAL}
          ON ${env.TABLE_CRIMINAL}.ROWID = ${env.TABLE_INCIDENT_CRIMINAL}.criminal_id
        INNER JOIN ${env.TABLE_CRIME_INCIDENT}
          ON ${env.TABLE_INCIDENT_CRIMINAL}.incident_id = ${env.TABLE_CRIME_INCIDENT}.ROWID
        ${whereClause}
      `;
    } else {
      sql = `SELECT * FROM ${env.TABLE_CRIMINAL}${whereClause}`;
    }

    const res = await executeQuery(req, sql);
    return res.map((r) => r[env.TABLE_CRIMINAL]);
  },

  async getOneCriminal(id, req) {
    const sql = `SELECT * FROM ${env.TABLE_CRIMINAL} WHERE ROWID = '${id}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) throw new Error('Criminal not found');
    return res[0][env.TABLE_CRIMINAL];
  },

  async updateCriminal(id, dto, req) {
    const table = getTable(req, env.TABLE_CRIMINAL);
    const updateObj = Object.assign({ ROWID: id }, dto);
    await table.updateRow(updateObj);
    return { message: 'Criminal updated' };
  },

  async deleteCriminal(id, req) {
    const table = getTable(req, env.TABLE_CRIMINAL);
    await table.deleteRow(id);
    return { message: 'Criminal deleted' };
  }
};
