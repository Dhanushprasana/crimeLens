'use strict';

const env = require('../../../config/env');

async function executeQuery(req, query) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  const zcql = req.catalyst.zcql();
  return zcql.executeZCQLQuery(query);
}

function getTable(req, name) { if (!req.catalyst) throw new Error('Catalyst SDK not initialized'); return req.catalyst.datastore().table(name); }

module.exports = {
  async addSuspect(dto, req) {
    const table = getTable(req, env.TABLE_SUSPECT);
    const row = {
      suspect_number: dto.suspect_number || null,
      full_name: dto.full_name,
      gender: dto.gender || null,
      date_of_birth: dto.date_of_birth || null,
      nationality: dto.nationality || null,
      photo_url: dto.photo_url || null,
      status: dto.status || 'ACTIVE',
      address: dto.address || null,
      district_id_of_suspect: dto.district_id_of_suspect || null
    };
    const saved = await table.insertRow(row);
    return { id: saved.ROWID };
  },

  async getAllSuspects(query, req) {
    const sql = `SELECT * FROM ${env.TABLE_SUSPECT}`;
    const res = await executeQuery(req, sql);
    return res.map(r => r[env.TABLE_SUSPECT]);
  },

  async getOneSuspect(id, req) {
    const sql = `SELECT * FROM ${env.TABLE_SUSPECT} WHERE ROWID = '${id}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) throw new Error('Suspect not found');
    return res[0][env.TABLE_SUSPECT];
  },

  async updateSuspect(id, dto, req) {
    const table = getTable(req, env.TABLE_SUSPECT);
    const updateObj = Object.assign({ ROWID: id }, dto);
    await table.updateRow(updateObj);
    return { message: 'Suspect updated' };
  },

  async deleteSuspect(id, req) {
    const table = getTable(req, env.TABLE_SUSPECT);
    await table.deleteRow(id);
    return { message: 'Suspect deleted' };
  }
};
