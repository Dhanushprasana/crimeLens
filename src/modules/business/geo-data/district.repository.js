"use strict";

const env = require("../../../config/env");
const fs = require("fs").promises;
const path = require("path");

async function executeQuery(req, query) {
  if (!req.catalyst) throw new Error("Catalyst SDK not initialized");
  const zcql = req.catalyst.zcql();
  return zcql.executeZCQLQuery(query);
}

function getTable(req, tableName) {
  if (!req.catalyst) throw new Error("Catalyst SDK not initialized");
  return req.catalyst.datastore().table(tableName);
}

module.exports = {
  async addDistrict(dto, req) {
    const table = getTable(req, env.TABLE_DISTRICT);
    const saved = await table.insertRow({ district_name: dto.district_name });
    return { id: saved.ROWID };
  },

  async getAllDistrict(query, req) {
    const sql = `SELECT * FROM ${env.TABLE_DISTRICT}`;
    const res = await executeQuery(req, sql);
    return res.map((r) => r[env.TABLE_DISTRICT]);
  },

  async getOneDistrict(id, req) {
    const sql = `SELECT * FROM ${env.TABLE_DISTRICT} WHERE ROWID = '${id}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) throw new Error("District not found");
    return res[0][env.TABLE_DISTRICT];
  },

  async deleteDistrict(id, req) {
    const table = getTable(req, env.TABLE_DISTRICT);
    await table.deleteRow(id);
    return { message: "District deleted" };
  },
  // GeoJSON operations stored in separate geodata table
  async addDistrictGeoJson(dto, req) {
    const table = getTable(req, env.TABLE_DISTRICT_GEODATA);
    const row = {
      district_code: dto.district_code || null,
      district_slug: dto.district_slug || null,
      district_name: dto.district_name,
      geometry_type: dto.geometry_type || null,
      boundary: dto.boundary, // should be text/GeoJSON
      center_lat: dto.center_lat || null,
      center_lng: dto.center_lng || null,
      coordinate_count: dto.coordinate_count || null,
    };
    const saved = await table.insertRow(row);
    return { id: saved.ROWID };
  },

  async getAllDistrictGeoJson(query, req) {
    const sql = `SELECT * FROM ${env.TABLE_DISTRICT_GEODATA}`;
    const res = await executeQuery(req, sql);
    return res.map((r) => r[env.TABLE_DISTRICT_GEODATA]);
  },

  async getOneDistrictGeoJson(id, req) {
    const sql = `SELECT * FROM ${env.TABLE_DISTRICT_GEODATA} WHERE ROWID = '${id}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) throw new Error("District geojson not found");
    return res[0][env.TABLE_DISTRICT_GEODATA];
  },

  async deleteDistrictGeoJson(id, req) {
    const table = getTable(req, env.TABLE_DISTRICT_GEODATA);
    await table.deleteRow(id);
    return { message: "District geojson deleted" };
  },

};
