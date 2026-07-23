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
  },

  async getFilteredCrimeCount(req) {
    logger.info("getFilteredCrimeCount");
    const zcql = req.catalyst ? req.catalyst.zcql() : null;
    if (!zcql) throw new Error("Catalyst not available");

    return this.buildAndExecuteCountQuery(req.query, zcql);
  },

  async getCrimeCountWithPreviousYear(req) {
    logger.info("getCrimeCountWithPreviousYear");
    const zcql = req.catalyst ? req.catalyst.zcql() : null;
    if (!zcql) throw new Error("Catalyst not available");

    const queryParams = { ...req.query };
    const currentCountRes = await this.buildAndExecuteCountQuery(queryParams, zcql);

    // Calculate previous year dates
    let prevQueryParams = { ...queryParams };
    
    if (prevQueryParams.date) {
      const d = new Date(prevQueryParams.date);
      d.setFullYear(d.getFullYear() - 1);
      prevQueryParams.date = d.toISOString().split('T')[0];
    }
    
    if (prevQueryParams.fromDate) {
      const fd = new Date(prevQueryParams.fromDate);
      fd.setFullYear(fd.getFullYear() - 1);
      prevQueryParams.fromDate = fd.toISOString().split('T')[0];
    }
    
    if (prevQueryParams.toDate) {
      const td = new Date(prevQueryParams.toDate);
      td.setFullYear(td.getFullYear() - 1);
      prevQueryParams.toDate = td.toISOString().split('T')[0];
    }

    const prevCountRes = await this.buildAndExecuteCountQuery(prevQueryParams, zcql);

    return {
      current_period_count: currentCountRes.total_crime_count,
      previous_year_count: prevCountRes.total_crime_count
    };
  },

  async getCrimeGrowth(req) {
    logger.info("getCrimeGrowth");
    const zcql = req.catalyst ? req.catalyst.zcql() : null;
    if (!zcql) throw new Error("Catalyst not available");

    const queryParams = { ...req.query };
    
    // We need fromDate and toDate to calculate growth properly
    if (!queryParams.fromDate || !queryParams.toDate) {
      throw new Error("fromDate and toDate are required to calculate growth");
    }

    const currentCountRes = await this.buildAndExecuteCountQuery(queryParams, zcql);
    const currentCount = currentCountRes.total_crime_count;

    const fromD = new Date(queryParams.fromDate);
    const toD = new Date(queryParams.toDate);
    const diffTime = Math.abs(toD - fromD);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both ends

    const prevToD = new Date(fromD);
    prevToD.setDate(prevToD.getDate() - 1);
    
    const prevFromD = new Date(prevToD);
    prevFromD.setDate(prevFromD.getDate() - diffDays + 1);

    const prevQueryParams = { ...queryParams };
    prevQueryParams.fromDate = prevFromD.toISOString().split('T')[0];
    prevQueryParams.toDate = prevToD.toISOString().split('T')[0];
    delete prevQueryParams.date; // ensure date is not used

    const prevCountRes = await this.buildAndExecuteCountQuery(prevQueryParams, zcql);
    const prevCount = prevCountRes.total_crime_count;

    let growthPercentage = 0;
    if (prevCount === 0) {
      growthPercentage = currentCount > 0 ? 100 : 0;
    } else {
      growthPercentage = ((currentCount - prevCount) / prevCount) * 100;
    }

    return {
      current_period_count: currentCount,
      previous_period_count: prevCount,
      difference: currentCount - prevCount,
      growth_percentage: parseFloat(growthPercentage.toFixed(2))
    };
  },

  async buildAndExecuteCountQuery(params, zcql) {
    // Determine if we need to join for gender
    let query = "";
    if (params.gender) {
      // Assuming gender is filtered via biz_suspect (which would be linked via biz_incident_criminals or similar, 
      // but biz_suspect doesn't have incident_id directly. If biz_suspect doesn't have incident_id, we can't join directly.
      // Wait, checking suspect repository, biz_suspect has district_id but NO incident_id.
      // We must join biz_incident_criminals which has incident_id and criminal_id, then join biz_criminal for gender.
      // Or maybe biz_case_victim has incident_id and gender.
      // Since Catalyst joins are limited, we'll try a basic approach:
      // We will count incidents where there exists a victim with this gender OR criminal with this gender.
      // For simplicity in ZCQL, we will do a join with biz_case_victim if filtering by victim gender.
      // As ZCQL limitations might break complex joins, let's just do a simple count on biz_crime_incident for now, 
      // and if gender is provided, we fetch incident IDs first.
      
      let incidentIds = new Set();
      
      // Check victims
      const victimQuery = `SELECT incident_id FROM ${env.TABLE_CASE_VICTIM} WHERE gender = '${params.gender}'`;
      try {
        const vRes = await zcql.executeZCQLQuery(victimQuery);
        (vRes || []).forEach(r => {
          if (r[env.TABLE_CASE_VICTIM] && r[env.TABLE_CASE_VICTIM].incident_id) {
            incidentIds.add(r[env.TABLE_CASE_VICTIM].incident_id);
          }
        });
      } catch (e) {
        logger.warn("Gender filter victim query failed", e.message);
      }
      
      if (incidentIds.size === 0) {
        return { total_crime_count: 0 };
      }
      
      const idsList = Array.from(incidentIds).map(id => `'${id}'`).join(',');
      query = `SELECT COUNT(ROWID) FROM ${env.TABLE_CRIME_INCIDENT} WHERE ROWID IN (${idsList})`;
    } else {
      query = `SELECT COUNT(ROWID) FROM ${env.TABLE_CRIME_INCIDENT}`;
    }

    const conditions = [];

    if (params.stationId) conditions.push(`police_station_id = '${params.stationId}'`);
    if (params.districtId) conditions.push(`crime_happended_at_district_id = '${params.districtId}'`);
    if (params.categoryId) conditions.push(`crime_category_id = '${params.categoryId}'`);

    if (params.date) {
      conditions.push(`crime_occured_date_time >= '${params.date} 00:00:00' AND crime_occured_date_time <= '${params.date} 23:59:59'`);
    } else {
      if (params.fromDate) conditions.push(`crime_occured_date_time >= '${params.fromDate} 00:00:00'`);
      if (params.toDate) conditions.push(`crime_occured_date_time <= '${params.toDate} 23:59:59'`);
    }

    if (conditions.length > 0) {
      if (query.includes("WHERE")) {
        query += ` AND ${conditions.join(" AND ")}`;
      } else {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }
    }

    try {
      const rows = await zcql.executeZCQLQuery(query);
      if (rows && rows.length > 0) {
        const firstRow = rows[0][env.TABLE_CRIME_INCIDENT] || rows[0];
        const count = firstRow["COUNT(ROWID)"] || Object.values(firstRow)[0];
        return { total_crime_count: Number(count) || 0 };
      }
      return { total_crime_count: 0 };
    } catch (e) {
      logger.warn("Failed to execute dynamic count query: " + query, e);
      throw e;
    }
  }
};
