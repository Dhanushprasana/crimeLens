'use strict';

const env = require('../../../config/env');

async function executeQuery(req, query) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  const zcql = req.catalyst.zcql();
  return zcql.executeZCQLQuery(query);
}

function getTable(req, name) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  return req.catalyst.datastore().table(name);
}

module.exports = {
  async addCrimeCategory(dto, req) {
    const table = getTable(req, env.TABLE_CRIME_CATEGORY);
    const row = {
      crime_category_name: dto.crime_category_name,
      description: dto.description || null,
      crime_category_number: dto.crime_category_number
    };
    const saved = await table.insertRow(row);
    return { id: saved.ROWID };
  },

  async getAllCrimeCategories(query, req) {
    const sql = `SELECT * FROM ${env.TABLE_CRIME_CATEGORY}`;
    const res = await executeQuery(req, sql);
    return res.map(r => r[env.TABLE_CRIME_CATEGORY]);
  },

  async getOneCrimeCategory(id, req) {
    const sql = `SELECT * FROM ${env.TABLE_CRIME_CATEGORY} WHERE ROWID = '${id}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) throw new Error('Crime category not found');
    return res[0][env.TABLE_CRIME_CATEGORY];
  },

  async updateCrimeCategory(id, dto, req) {
    const table = getTable(req, env.TABLE_CRIME_CATEGORY);
    const updateObj = Object.assign({ ROWID: id }, dto);
    await table.updateRow(updateObj);
    return { message: 'Crime category updated' };
  },

  async deleteCrimeCategory(id, req) {
    const table = getTable(req, env.TABLE_CRIME_CATEGORY);
    await table.deleteRow(id);
    return { message: 'Crime category deleted' };
  }
};
