"use strict";

const repository = require("./district.repository");
const logger = require("../../config/logger");
const fs = require("fs").promises;
const path = require("path");
const policeRepo = require("../business/police/police-officer/police-officer.repository");

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
};
