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
  async addSuspectPhoto(dto, req) {
    const table = getTable(req, env.TABLE_SUSPECT_PHOTO);
    const row = {
      photo_url: dto.photo_url,
      suspect_id: dto.suspect_id
    };
    const saved = await table.insertRow(row);
    return { id: saved.ROWID };
  },

  async getPhotosBySuspect(suspectId, req) {
    const sql = `SELECT * FROM ${env.TABLE_SUSPECT_PHOTO} WHERE suspect_id = '${suspectId}'`;
    const res = await executeQuery(req, sql);
    return (res || []).map(r => r[env.TABLE_SUSPECT_PHOTO]);
  },

  async deleteSuspectPhoto(id, req) {
    const table = getTable(req, env.TABLE_SUSPECT_PHOTO);
    await table.deleteRow(id);
    return { message: 'Suspect photo deleted' };
  }
};
