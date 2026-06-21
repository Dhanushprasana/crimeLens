"use strict";

const env = require("../../../../config/env");
const fs = require("fs").promises;
const path = require("path");
const districtRepo = require("../../geo-data/district.repository");
const logger = require("../../../../config/logger");

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

    // Use provided district_id; service layer should handle district lookups
    const districtId = dto.district_id || null;

    const row = {
      district_id: districtId,
      station_name: dto.station_name,
      station_code: dto.station_code || null,
      latitude: dto.latitude || null,
      longitude: dto.longitude || null,
      address: dto.address || null,
      station_type_id: dto.station_type_id || null,
    };

    try {
      logger.debug("inserting police station", {
        station: row.station_name,
        district_id: row.district_id,
      });
      const saved = await table.insertRow(row);
      return { id: saved.ROWID };
    } catch (err) {
      logger.warn("police station insert failed", {
        payload: row,
        error: err && err.message ? err.message : err,
      });
      throw err;
    }
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
              `SELECT ROWID FROM ${env.TABLE_DISTRICT_GEODATA} WHERE district_code = '${districtCode}' LIMIT 1`,
            );
            logger.debug("district code lookup", {
              districtCode,
              rows: (rows && rows.length) || 0,
            });
            if (rows && rows.length)
              district_id =
                rows[0].ROWID ||
                rows[0][env.TABLE_DISTRICT_GEODATA]?.ROWID ||
                null;
          }
          if (!district_id && districtName) {
            const rows = await executeQuery(
              req,
              `SELECT ROWID FROM ${env.TABLE_DISTRICT_GEODATA} WHERE district_name = '${districtName}' LIMIT 1`,
            );
            logger.debug("district name lookup", {
              districtName,
              rows: (rows && rows.length) || 0,
            });
            if (rows && rows.length)
              district_id =
                rows[0].ROWID ||
                rows[0][env.TABLE_DISTRICT_GEODATA]?.ROWID ||
                null;
            // If still not found, create a minimal district record so station can reference it
            if (!district_id) {
              try {
                const slug = (districtName || "")
                  .toString()
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/(^-|-$)/g, "");
                const payload = {
                  district_name: districtName,
                  district_slug: slug,
                };
                if (districtCode) payload.district_code = districtCode;
                logger.info("creating fallback district", {
                  district: districtName,
                });
                const created = await districtRepo.addDistrict(payload, req);
                if (created && created.id) {
                  district_id = created.id;
                  logger.info("created fallback district", {
                    district: districtName,
                    id: district_id,
                  });
                }
              } catch (err) {
                logger.warn("failed to create fallback district", {
                  district: districtName,
                  error: err && err.message ? err.message : err,
                });
                district_id = null;
              }
            }
          }
        } catch (err) {
          logger.warn("district lookup error", {
            districtName,
            districtCode,
            error: err && err.message ? err.message : err,
          });
          // ignore lookup errors and proceed
          district_id = null;
        }

        // If still no district_id, try to use or create a generic 'unknown' district so inserts can proceed
        if (!district_id) {
          try {
            const rows = await executeQuery(
              req,
              `SELECT ROWID FROM ${env.TABLE_DISTRICT_GEODATA} WHERE district_slug = 'unknown' LIMIT 1`,
            );
            if (rows && rows.length) {
              district_id =
                rows[0].ROWID ||
                rows[0][env.TABLE_DISTRICT_GEODATA]?.ROWID ||
                null;
            } else {
              logger.info("creating generic unknown district");
              const created = await districtRepo.addDistrict(
                { district_name: "Unknown", district_slug: "unknown" },
                req,
              );
              if (created && created.id) district_id = created.id;
            }
          } catch (err) {
            logger.warn("failed to ensure generic unknown district", {
              error: err && err.message ? err.message : err,
            });
            district_id = null;
          }
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
