'use strict';

const env = require('../../../../config/env');

async function executeQuery(req, query) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  return req.catalyst.zcql().executeZCQLQuery(query);
}

function getTable(req, name) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  return req.catalyst.datastore().table(name);
}

module.exports = {
  async addWitness(dto, req) {
    const table = getTable(req, env.TABLE_CASE_WITNESS);
    const row = {
      incident_id: dto.incident_id,
      full_name: dto.full_name,
      gender: dto.gender || null,
      age: dto.age || null,
      mobile_number: dto.mobile_number || null,
      email: dto.email || null,
      address: dto.address || null,
      occupation: dto.occupation || null,
      witness_type: dto.witness_type || null,
      statement: dto.statement || null
    };
    const saved = await table.insertRow(row);
    return { id: saved.ROWID };
  },

  async getWitnessesByIncident(incidentId, req) {
    const sql = `SELECT * FROM ${env.TABLE_CASE_WITNESS} WHERE incident_id = '${incidentId}'`;
    const res = await executeQuery(req, sql);
    return (res || []).map(r => r[env.TABLE_CASE_WITNESS]);
  },

  async getOneWitness(id, req) {
    const sql = `SELECT * FROM ${env.TABLE_CASE_WITNESS} WHERE ROWID = '${id}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) throw new Error('Witness not found');
    return res[0][env.TABLE_CASE_WITNESS];
  },

  async updateWitness(id, dto, req) {
    const table = getTable(req, env.TABLE_CASE_WITNESS);
    await table.updateRow(Object.assign({ ROWID: id }, dto));
    return { message: 'Witness updated' };
  },

  async deleteWitness(id, req) {
    const table = getTable(req, env.TABLE_CASE_WITNESS);
    await table.deleteRow(id);
    return { message: 'Witness deleted' };
  }
};
