"use strict";

const env = require("../../../config/env");
const logger = require("../../../config/logger");
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
    const table = getTable(req, env.TABLE_DISTRICT_GEODATA);
    const row = {
      district_code:
        dto.district_code ||
        (dto.district_slug
          ? dto.district_slug.toString().toUpperCase()
          : null) ||
        (dto.district_name
          ? dto.district_name
              .replace(/[^A-Za-z0-9]/g, "")
              .substring(0, 20)
              .toUpperCase()
          : "UNKNOWN"),
      district_slug: dto.district_slug || null,
      district_name: dto.district_name,
      geometry_type: dto.geometry_type || "MultiPolygon",
      boundary:
        dto.boundary ||
        JSON.stringify({ type: "MultiPolygon", coordinates: [] }),
      center_lat: dto.center_lat || null,
      center_lng: dto.center_lng || null,
      coordinate_count: dto.coordinate_count || null,
    };
    try {
      const saved = await table.insertRow(row);
      return { id: saved.ROWID };
    } catch (err) {
      logger.warn("addDistrict failed", {
        dto: row,
        error: err && err.message ? err.message : err,
      });
      throw err;
    }
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

  async getAllDistrict(query, req) {
    const sql = `SELECT * FROM ${env.TABLE_DISTRICT_GEODATA}`;
    const res = await executeQuery(req, sql);
    return res.map((r) => {
      const item = r[env.TABLE_DISTRICT_GEODATA];
      let geometry = null;
      if (item.boundary) {
        try {
          geometry = typeof item.boundary === "string" ? JSON.parse(item.boundary) : item.boundary;
        } catch (e) {
          logger.warn("failed to parse boundary JSON", e);
        }
      }
      return {
        id: item.ROWID,
        name: item.district_name,
        code: item.district_code,
        state: "Karnataka",
        geometry: geometry,
        center_lat: item.center_lat,
        center_lng: item.center_lng,
        coordinate_count: item.coordinate_count,
      };
    });
  },

  async getOneDistrict(id, req) {
    const sql = `SELECT * FROM ${env.TABLE_DISTRICT_GEODATA} WHERE ROWID = '${id}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) throw new Error("District not found");
    const item = res[0][env.TABLE_DISTRICT_GEODATA];
    let geometry = null;
    if (item.boundary) {
      try {
        geometry = typeof item.boundary === "string" ? JSON.parse(item.boundary) : item.boundary;
      } catch (e) {
        logger.warn("failed to parse boundary JSON", e);
      }
    }
    return {
      id: item.ROWID,
      name: item.district_name,
      code: item.district_code,
      state: "Karnataka",
      geometry: geometry,
      center_lat: item.center_lat,
      center_lng: item.center_lng,
      coordinate_count: item.coordinate_count,
    };
  },

  async deleteDistrict(id, req) {
    const table = getTable(req, env.TABLE_DISTRICT_GEODATA);
    await table.deleteRow(id);
    return { message: "District deleted" };
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

  async bootstrapDistrictGeoJson(req) {
    const filePath = path.join(
      __dirname,
      "..",
      "..",
      "seed-data",
      "data",
      "district",
      "karnataka-districts.geojson",
    );
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw || "{}");
    const features =
      parsed.type === "FeatureCollection" && Array.isArray(parsed.features)
        ? parsed.features
        : Array.isArray(parsed)
          ? parsed
          : [];

    const table = getTable(req, env.TABLE_DISTRICT_GEODATA);
    let created = 0;
    let skipped = 0;

    for (const feat of features) {
      const props = feat.properties || {};
      const geom = feat.geometry || null;

      const district_code = props.district_code || props.districtCode || null;
      const district_slug = props.districtId || props.district_id || null;
      const district_name = props.districtName || props.district_name || null;
      const geometry_type = geom ? geom.type : null;
      const boundary = JSON.stringify(geom || {});

      // compute a simple centroid by averaging all coordinate pairs
      let latSum = 0,
        lngSum = 0,
        coordCount = 0;
      function collect(coords) {
        if (!Array.isArray(coords)) return;
        if (typeof coords[0] === "number" && typeof coords[1] === "number") {
          lngSum += coords[0];
          latSum += coords[1];
          coordCount++;
          return;
        }
        for (const c of coords) collect(c);
      }
      collect(geom && geom.coordinates);

      const center_lat = coordCount ? latSum / coordCount : null;
      const center_lng = coordCount ? lngSum / coordCount : null;

      try {
        await table.insertRow({
          district_code,
          district_slug,
          district_name,
          geometry_type,
          boundary,
          center_lat,
          center_lng,
          coordinate_count: coordCount,
        });
        created++;
      } catch (err) {
        logger.warn(
          "failed to insert district geodata",
          district_name,
          err && err.message ? err.message : err,
        );
        skipped++;
      }
    }

    return { created, skipped, total: features.length };
  },
};
