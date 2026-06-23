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
  },

  async getTotalCrimeCount(req) {
    logger.info("getTotalCrimeCount");
    const zcql = req.catalyst ? req.catalyst.zcql() : null;
    if (!zcql) throw new Error("Catalyst not available");

    try {
      const rows = await zcql.executeZCQLQuery(`SELECT SUM(crime_count) as total_crime_count FROM ${env.TABLE_COMP_DISTRICT_CRIME_STATS}`);
      if (rows && rows.length > 0) {
        const firstRow = rows[0][env.TABLE_COMP_DISTRICT_CRIME_STATS] || rows[0];
        const sum = firstRow.total_crime_count || firstRow["SUM(crime_count)"] || Object.values(firstRow)[0];
        return { total_crime_count: Number(sum) || 0 };
      }
      return { total_crime_count: 0 };
    } catch (e) {
      logger.warn("Failed to fetch total crime count", e);
      throw e;
    }
  }
};
