'use strict';

const env = require('../../../config/env');

async function executeQuery(req, query) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  const zcql = req.catalyst.zcql();
  return zcql.executeZCQLQuery(query);
}

function getTable(req, name) { if (!req.catalyst) throw new Error('Catalyst SDK not initialized'); return req.catalyst.datastore().table(name); }

module.exports = {
  async addFir(dto, req) {
    const table = getTable(req, env.TABLE_FIR);
    const row = {
      fir_number: dto.fir_number || null,
      complainant_name: dto.complainant_name,
      complainant_phone: dto.complainant_phone || null,
      incident_description: dto.incident_description || null,
      assigned_officer_id: dto.assigned_officer_id || null,
      district_id: dto.district_id || null,
      fir_status: dto.fir_status || null,
      police_station_id: dto.police_station_id || null
    };
    const saved = await table.insertRow(row);
    return { id: saved.ROWID };
  },

  async getAllFir(query, req) {
    const sql = `SELECT * FROM ${env.TABLE_FIR}`;
    const res = await executeQuery(req, sql);
    return res.map(r => r[env.TABLE_FIR]);
  },

  async getOneFir(id, req) {
    const sql = `SELECT * FROM ${env.TABLE_FIR} WHERE ROWID = '${id}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) throw new Error('FIR not found');
    return res[0][env.TABLE_FIR];
  },

  async updateFir(id, dto, req) {
    const table = getTable(req, env.TABLE_FIR);
    const updateObj = Object.assign({ ROWID: id }, dto);
    await table.updateRow(updateObj);
    return { message: 'FIR updated' };
  },

  async deleteFir(id, req) {
    const table = getTable(req, env.TABLE_FIR);
    await table.deleteRow(id);
    return { message: 'FIR deleted' };
  }
};
