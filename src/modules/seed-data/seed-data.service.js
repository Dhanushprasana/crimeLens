"use strict";

const repository = require("../business/geo-data/district.repository");
const logger = require("../../config/logger");
const fs = require("fs").promises;
const path = require("path");
const policeRepo = require("../business/police/police-officer/police-officer.repository");
const stationRepo = require("../business/police/police-station/police-station.repository");
const env = require("../../config/env");

module.exports = {
  async bootstrapDistrictGeoJson(req) {
    logger.info("bootstrapDistrictGeoJson");
    return repository.bootstrapDistrictGeoJson(req);
  },

  async bootstrapPoliceRank(req) {
    logger.info("bootstrapPoliceRank");
    const filePath = path.join(
      __dirname,
      "data",
      "police-officer",
      "police_rank.json",
    );
    const raw = await fs.readFile(filePath, "utf8");
    const entries = JSON.parse(raw || "[]");

    // Fetch existing ranks to avoid duplicates
    let existing = [];
    try {
      existing = await policeRepo.getAllRanks(null, req);
    } catch (err) {
      logger.warn("Could not fetch existing ranks:", err.message || err);
      existing = [];
    }
    const existingNames = new Set(
      (existing || []).map((r) => (r.rank_name || "").trim().toLowerCase()),
    );

    let created = 0;
    let skipped = 0;
    for (const e of entries) {
      const name = (e.rank_name || "").trim();
      if (!name) continue;
      if (existingNames.has(name.toLowerCase())) {
        skipped++;
        continue;
      }
      await policeRepo.createRank(
        { rank_name: name, hierarchy_level: e.hierarchy_level },
        req,
      );
      created++;
    }

    return { created, skipped };
  },

  async bootstrapPoliceStations(req) {
    logger.info("bootstrapPoliceStations");
    const filePath = path.join(
      __dirname,
      "data",
      "police-station",
      "police_stations.geojson",
    );
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw || "{}");
    const features =
      parsed.type === "FeatureCollection" && Array.isArray(parsed.features)
        ? parsed.features
        : Array.isArray(parsed)
          ? parsed
          : [];

    let created = 0;
    let skipped = 0;
    const zcql = req.catalyst ? req.catalyst.zcql() : null;

    for (const feat of features) {
      const props = feat.properties || {};
      const geom = feat.geometry || null;

      const name =
        props.POL_STAName || props.station_name || props.name || null;
      if (!name) {
        skipped++;
        continue;
      }

      let latitude = null,
        longitude = null;
      if (geom && geom.type === "Point" && Array.isArray(geom.coordinates)) {
        longitude = geom.coordinates[0] || null;
        latitude = geom.coordinates[1] || null;
      }

      const station_code =
        props.KGISPSCode || props.station_code || props.code || null;
      const address = props.address || props.ADDRESS || null;

      // resolve district id from biz_district_detail by districtName property
      let district_id = null;
      const districtName =
        props.districtName ||
        props.DISTRICT ||
        props.DISTRICT_NAME ||
        props.district_name ||
        null;
      if (districtName && zcql) {
        try {
          const safeName = districtName.replace(/'/g, "''");
          const rows = await zcql.executeZCQLQuery(
            `SELECT ROWID FROM ${env.TABLE_DISTRICT} WHERE district_name = '${safeName}' LIMIT 1`,
          );
          if (rows && rows.length) district_id = rows[0].ROWID || null;
        } catch (err) {
          logger.warn(
            "district lookup failed",
            err && err.message ? err.message : err,
          );
        }
      }

      try {
        await stationRepo.addPoliceStation(
          {
            district_id,
            station_name: name,
            station_code,
            latitude,
            longitude,
            address,
            station_type_id: null,
          },
          req,
        );
        created++;
      } catch (err) {
        logger.warn(
          "failed to insert station",
          name,
          err && err.message ? err.message : err,
        );
        skipped++;
      }
    }

    return { created, skipped, total: features.length };
  },
};
