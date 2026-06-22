"use strict";

const env = require("../../../config/env");
const logger = require("../../../config/logger");

module.exports = {
  async getDistrictCrimeStats(req) {
    logger.info("getDistrictCrimeStats");
    const zcql = req.catalyst ? req.catalyst.zcql() : null;
    if (!zcql) throw new Error("Catalyst not available");

    try {
      const rows = await zcql.executeZCQLQuery(`SELECT * FROM ${env.TABLE_COMP_DISTRICT_CRIME_STATS}`);
      const stats = rows.map(r => r[env.TABLE_COMP_DISTRICT_CRIME_STATS] || r);
      return stats;
    } catch (e) {
      logger.warn("Failed to fetch district crime stats", e);
      throw e;
    }
  }
};
