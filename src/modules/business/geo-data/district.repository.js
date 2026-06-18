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
  async bootstrapDistrictGeoJson(req) {
    const seedDir = path.resolve(__dirname, "seed-data");
    let files;
    try {
      files = await fs.readdir(seedDir);
    } catch (err) {
      throw new Error(`Seed-data directory not found: ${seedDir}`);
    }

    const geoFiles = files.filter(
      (f) => f.endsWith(".geojson") || f.endsWith(".json"),
    );
    const table = getTable(req, env.TABLE_DISTRICT_GEODATA);
    let totalInserted = 0;
    for (const file of geoFiles) {
      const filePath = path.join(seedDir, file);
      let raw;
      try {
        raw = await fs.readFile(filePath, "utf8");
      } catch (err) {
        continue;
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        continue;
      }

      // If FeatureCollection
      const features =
        parsed.type === "FeatureCollection" && Array.isArray(parsed.features)
          ? parsed.features
          : Array.isArray(parsed)
            ? parsed
            : [];
      if (features.length === 0 && parsed.type === "Feature") {
        features.push(parsed);
      }

      for (const feat of features) {
        const geometry = feat.geometry || null;
        const props = feat.properties || {};
        const name =
          props.district_name ||
          props.name ||
          props.NAME ||
          props.DISTRICT ||
          props.DISTRICT_NAME ||
          null;
        const district_name =
          name ||
          props.DISTRICT_NAME ||
          props.NAME ||
          path.basename(file, path.extname(file));
        const geometry_type = geometry ? geometry.type : null;
        const boundary = geometry ? JSON.stringify(geometry) : null;

        // simple coordinate counter
        function countCoords(coords) {
          if (!coords) return 0;
          if (typeof coords[0] === "number") return 1;
          let c = 0;
          for (const item of coords) c += countCoords(item);
          return c;
        }

        const coordinate_count =
          geometry && geometry.coordinates
            ? countCoords(geometry.coordinates)
            : null;
        const center_lat =
          props.center_lat || props.centerLat || props.CENTROID_LAT || null;
        const center_lng =
          props.center_lng || props.centerLng || props.CENTROID_LNG || null;

        await table.insertRow({
          district_code: props.district_code || props.DISTRICT_CODE || null,
          district_slug: props.district_slug || null,
          district_name,
          geometry_type,
          boundary,
          center_lat,
          center_lng,
          coordinate_count,
        });
        totalInserted++;
      }
    }

    return {
      message: "Bootstrap complete",
      filesProcessed: geoFiles.length,
      totalInserted,
    };
  },
};
