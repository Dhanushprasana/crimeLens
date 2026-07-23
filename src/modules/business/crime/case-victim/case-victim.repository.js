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
  async addVictim(dto, req) {
    const table = getTable(req, env.TABLE_CASE_VICTIM);
    const row = {
      incident_id: dto.incident_id,
      full_name: dto.full_name,
      gender: dto.gender || null,
      mobile_number: dto.mobile_number || null,
      email: dto.email || null,
      address: dto.address || null,
      occupation: dto.occupation || null,
      injury_type: dto.injury_type || null,
      medical_report_number: dto.medical_report_number || null,
      alive: dto.alive !== undefined ? dto.alive : true
    };
    const saved = await table.insertRow(row);
    return { id: saved.ROWID };
  },

  async getVictimsByIncident(incidentId, req) {
    const sql = `SELECT * FROM ${env.TABLE_CASE_VICTIM} WHERE incident_id = '${incidentId}'`;
    const res = await executeQuery(req, sql);
    return (res || []).map(r => r[env.TABLE_CASE_VICTIM]);
  },

  async getOneVictim(id, req) {
    const sql = `SELECT * FROM ${env.TABLE_CASE_VICTIM} WHERE ROWID = '${id}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) throw new Error('Victim not found');
    return res[0][env.TABLE_CASE_VICTIM];
  },

  async updateVictim(id, dto, req) {
    const table = getTable(req, env.TABLE_CASE_VICTIM);
    await table.updateRow(Object.assign({ ROWID: id }, dto));
    return { message: 'Victim updated' };
  },

  async deleteVictim(id, req) {
    const table = getTable(req, env.TABLE_CASE_VICTIM);
    await table.deleteRow(id);
    return { message: 'Victim deleted' };
  }
};
