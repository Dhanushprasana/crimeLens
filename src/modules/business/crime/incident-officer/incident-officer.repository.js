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
  async assignOfficer(dto, req) {
    const table = getTable(req, env.TABLE_INCIDENT_OFFICER);
    const row = {
      incident_id: dto.incident_id,
      officer_id: dto.officer_id
    };
    const saved = await table.insertRow(row);
    return { id: saved.ROWID };
  },

  async getOfficersByIncident(incidentId, req) {
    const sql = `SELECT * FROM ${env.TABLE_INCIDENT_OFFICER} WHERE incident_id = '${incidentId}'`;
    const res = await executeQuery(req, sql);
    return (res || []).map(r => r[env.TABLE_INCIDENT_OFFICER]);
  },

  async getIncidentsByOfficer(officerId, req) {
    const sql = `SELECT * FROM ${env.TABLE_INCIDENT_OFFICER} WHERE officer_id = '${officerId}'`;
    const res = await executeQuery(req, sql);
    return (res || []).map(r => r[env.TABLE_INCIDENT_OFFICER]);
  },

  async removeOfficer(id, req) {
    const table = getTable(req, env.TABLE_INCIDENT_OFFICER);
    await table.deleteRow(id);
    return { message: 'Officer removed from incident' };
  }
};
