"use strict";

const env = require("../../../../config/env");
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
  async addPoliceStation(dto, req) {
    const table = getTable(req, env.TABLE_POLICE_STATION);
    const row = {
      district_id: dto.district_id || null,
      station_name: dto.station_name,
      station_code: dto.station_code || null,
      latitude: dto.latitude || null,
      longitude: dto.longitude || null,
      address: dto.address || null,
      station_type_id: dto.station_type_id || null,
    };
    const saved = await table.insertRow(row);
    return { id: saved.ROWID };
  },

  async getAllPoliceStation(query, req) {
    const sql = `SELECT * FROM ${env.TABLE_POLICE_STATION}`;
    const res = await executeQuery(req, sql);
    return res.map((r) => r[env.TABLE_POLICE_STATION]);
  },

  async getOnePoliceStation(id, req) {
    const sql = `SELECT * FROM ${env.TABLE_POLICE_STATION} WHERE ROWID = '${id}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) throw new Error("Station not found");
    return res[0][env.TABLE_POLICE_STATION];
  },

  async updatePoliceStation(id, dto, req) {
    const table = getTable(req, env.TABLE_POLICE_STATION);
    const updateObj = Object.assign({ ROWID: id }, dto);
    await table.updateRow(updateObj);
    return { message: "Station updated" };
  },

  async deletePoliceStation(id, req) {
    const table = getTable(req, env.TABLE_POLICE_STATION);
    await table.deleteRow(id);
    return { message: "Station deleted" };
  },

  // Station type
  async addStationType(dto, req) {
    const table = getTable(req, env.TABLE_STATION_TYPE);
    const saved = await table.insertRow({
      station_type_name: dto.station_type_name,
    });
    return { id: saved.ROWID };
  },

  async getAllStationType(query, req) {
    const sql = `SELECT * FROM ${env.TABLE_STATION_TYPE}`;
    const res = await executeQuery(req, sql);
    return res.map((r) => r[env.TABLE_STATION_TYPE]);
  },

  async deleteStationType(id, req) {
    const table = getTable(req, env.TABLE_STATION_TYPE);
    await table.deleteRow(id);
    return { message: "Station type deleted" };
  },
  async bootstrapPoliceStations(req) {
    // seed-data is stored under the geo-data module
    const seedDir = path.resolve(__dirname, "../../../geo-data/seed-data");
    let files;
    try {
      files = await fs.readdir(seedDir);
    } catch (err) {
      throw new Error(`Seed-data directory not found: ${seedDir}`);
    }

    const geoFiles = files.filter(
      (f) => f.endsWith(".geojson") || f.endsWith(".json"),
    );
    const table = getTable(req, env.TABLE_POLICE_STATION);
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

      const features =
        parsed.type === "FeatureCollection" && Array.isArray(parsed.features)
          ? parsed.features
          : Array.isArray(parsed)
            ? parsed
            : [];
      if (features.length === 0 && parsed.type === "Feature")
        features.push(parsed);

      for (const feat of features) {
        const geometry = feat.geometry || null;
        const props = feat.properties || {};

        const name =
          props.station_name ||
          props.name ||
          props.NAME ||
          props.STATION_NAME ||
          null;
        if (!name) continue; // skip entries without station name

        let latitude = null;
        let longitude = null;
        if (
          geometry &&
          geometry.type === "Point" &&
          Array.isArray(geometry.coordinates)
        ) {
          longitude = geometry.coordinates[0] || null;
          latitude = geometry.coordinates[1] || null;
        } else if (
          geometry &&
          geometry.type === "MultiPoint" &&
          Array.isArray(geometry.coordinates) &&
          geometry.coordinates[0]
        ) {
          longitude = geometry.coordinates[0][0] || null;
          latitude = geometry.coordinates[0][1] || null;
        }

        // attempt to resolve district by name or code
        let district_id = null;
        const districtName =
          props.district_name ||
          props.DISTRICT ||
          props.DISTRICT_NAME ||
          props.district ||
          null;
        const districtCode = props.district_code || props.DISTRICT_CODE || null;
        try {
          if (districtCode) {
            const rows = await executeQuery(
              req,
              `SELECT ROWID FROM ${env.TABLE_DISTRICT} WHERE district_code = '${districtCode}' LIMIT 1`,
            );
            if (rows && rows.length) district_id = rows[0].ROWID || null;
          }
          if (!district_id && districtName) {
            const rows = await executeQuery(
              req,
              `SELECT ROWID FROM ${env.TABLE_DISTRICT} WHERE district_name = '${districtName}' LIMIT 1`,
            );
            if (rows && rows.length) district_id = rows[0].ROWID || null;
          }
        } catch (err) {
          // ignore lookup errors and proceed
          district_id = null;
        }

        const station_code =
          props.station_code || props.STATION_CODE || props.code || null;
        const address = props.address || props.ADDRESS || props.addr || null;

        await table.insertRow({
          district_id: district_id,
          station_name: name,
          station_code: station_code,
          latitude,
          longitude,
          address,
          station_type_id: null,
        });
        totalInserted++;
      }
    }

    return {
      message: "Police stations bootstrap complete",
      filesProcessed: geoFiles.length,
      totalInserted,
    };
  },
};
