'use strict';

const env = require('../../../config/env');

async function executeQuery(req, query) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  const zcql = req.catalyst.zcql();
  return zcql.executeZCQLQuery(query);
}

function getTable(req) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  return req.catalyst.datastore().table(env.TABLE_EVIDENCE_MATCH);
}

module.exports = {
  async create(dto, req) {
    const table = getTable(req);
    const row = {
      source_evidence_id:  dto.source_evidence_id,
      matched_evidence_id: dto.matched_evidence_id,
      evidence_type:       dto.evidence_type,
      confidence:          dto.confidence  || null,
      verified:            dto.verified    !== undefined ? dto.verified : false,
    };
    const saved = await table.insertRow(row);
    return saved;
  },

  async getAll(req) {
    const sql = `SELECT * FROM ${env.TABLE_EVIDENCE_MATCH}`;
    const rows = await executeQuery(req, sql);
    return rows.map(r => r[env.TABLE_EVIDENCE_MATCH] || r);
  },

  async getById(id, req) {
    const sql = `SELECT * FROM ${env.TABLE_EVIDENCE_MATCH} WHERE ROWID = '${id}'`;
    const rows = await executeQuery(req, sql);
    if (!rows || rows.length === 0) return null;
    return rows[0][env.TABLE_EVIDENCE_MATCH] || rows[0];
  },

  async getBySourceEvidence(sourceId, req) {
    const sql = `SELECT * FROM ${env.TABLE_EVIDENCE_MATCH} WHERE source_evidence_id = '${sourceId}'`;
    const rows = await executeQuery(req, sql);
    return rows.map(r => r[env.TABLE_EVIDENCE_MATCH] || r);
  },

  async update(id, dto, req) {
    const table = getTable(req);
    const updateObj = Object.assign({ ROWID: id }, dto);
    await table.updateRow(updateObj);
    return { message: 'Evidence match updated' };
  },

  async remove(id, req) {
    const table = getTable(req);
    await table.deleteRow(id);
    return { message: 'Evidence match deleted' };
  },
};
