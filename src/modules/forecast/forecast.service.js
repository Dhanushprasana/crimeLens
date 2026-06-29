"use strict";

const constants = require("./forecast.constants");
const prediction = require("./forecast.prediction");
const logger = require("../../config/logger");

const generator = require("./forecast.generate");


async function generateForecast(req, options = {}) {
  return generator.generateForecast(req, options);
}

async function getForecasts(req, query = {}) {
  // read from constants.FORECAST_TABLE using query filters
  try {
    const zcql = req.catalyst ? req.catalyst.zcql() : null;
    const where = [];
    if (query.district_id)
      where.push(
        `district_id = '${(query.district_id + "").replace(/'/g, "''")}'`,
      );
    if (query.police_station_id)
      where.push(
        `police_station_id = '${(query.police_station_id + "").replace(/'/g, "''")}'`,
      );
    if (query.crime_category_id)
      where.push(
        `crime_category_id = '${(query.crime_category_id + "").replace(/'/g, "''")}'`,
      );
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    if (zcql) {
      const rows = await zcql.executeZCQLQuery(
        `SELECT forecast_date, predicted_count FROM ${constants.FORECAST_TABLE} ${whereSql} ORDER BY forecast_date DESC LIMIT 100`,
      );
      return rows || [];
    }
  } catch (err) {
    // fallthrough
  }
  return [
    {
      forecast_date: new Date().toISOString().slice(0, 10),
      predicted_count: 15,
    },
  ];
}


// polling logic moved to forecast.training module

async function detectAnomalies(req, filters = {}) {
  const zcql = req.catalyst ? req.catalyst.zcql() : null;
  if (!zcql) throw new Error("Catalyst SDK not available");

  const env = require("../../config/env");

  // 1. Build dynamic WHERE clause
  const where = [];
  if (filters.start_date) where.push(`incident_registered_date >= '${filters.start_date}'`);
  if (filters.end_date) where.push(`incident_registered_date <= '${filters.end_date}'`);
  if (filters.district_id) where.push(`crime_happended_at_district_id = '${filters.district_id}'`);
  if (filters.police_station_id) where.push(`police_station_id = '${filters.police_station_id}'`);
  if (filters.crime_category_id) where.push(`crime_category_id = '${filters.crime_category_id}'`);

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // 2. Aggregate actuals
  const actualsSql = `
    SELECT 
      crime_happended_at_district_id, 
      police_station_id, 
      crime_category_id, 
      incident_registered_date, 
      COUNT(ROWID) AS actual_count 
    FROM ${env.TABLE_CRIME_INCIDENT} 
    ${whereClause} 
    GROUP BY 
      crime_happended_at_district_id, 
      police_station_id, 
      crime_category_id, 
      incident_registered_date
  `;
  const actualsResult = await zcql.executeZCQLQuery(actualsSql);
  const actuals = actualsResult.map(r => r[env.TABLE_CRIME_INCIDENT]);

  // 3. Fetch matching forecasts
  const fcWhere = [];
  if (filters.start_date) fcWhere.push(`forecast_date >= '${filters.start_date}'`);
  if (filters.end_date) fcWhere.push(`forecast_date <= '${filters.end_date}'`);
  if (filters.district_id) fcWhere.push(`district_id = '${filters.district_id}'`);
  if (filters.police_station_id) fcWhere.push(`police_station_id = '${filters.police_station_id}'`);
  if (filters.crime_category_id) fcWhere.push(`crime_category_id = '${filters.crime_category_id}'`);

  const fcWhereClause = fcWhere.length ? `WHERE ${fcWhere.join(" AND ")}` : "";
  const fcSql = `
    SELECT 
      district_id, 
      police_station_id, 
      crime_category_id, 
      forecast_date, 
      predicted_count 
    FROM ${constants.FORECAST_TABLE} 
    ${fcWhereClause}
  `;
  const fcResult = await zcql.executeZCQLQuery(fcSql);
  const forecasts = fcResult.map(r => r[constants.FORECAST_TABLE]);

  // 4. Compare and generate anomalies
  const anomalies = [];
  for (const act of actuals) {
    const actDist = act.crime_happended_at_district_id;
    const actStation = act.police_station_id;
    const actCat = act.crime_category_id;
    const actDate = act.incident_registered_date;
    const actualCount = act.actual_count || 0;

    // Find matching forecast
    const fc = forecasts.find(f => 
      f.district_id === actDist &&
      f.police_station_id === actStation &&
      f.crime_category_id === actCat &&
      f.forecast_date === actDate
    );

    if (fc) {
      const predictedCount = parseFloat(fc.predicted_count) || 0;
      const residual = actualCount - predictedCount;
      const deviationPercent = predictedCount === 0 
        ? (actualCount > 0 ? 100 : 0) 
        : (Math.abs(residual) / predictedCount) * 100;

      let severity = null;
      if (deviationPercent > 200) severity = "CRITICAL";
      else if (deviationPercent > 100) severity = "HIGH";
      else if (deviationPercent > 50) severity = "ANOMALY";

      if (severity) {
        anomalies.push({
          district_id: actDist,
          police_station_id: actStation,
          crime_category_id: actCat,
          anomaly_date: actDate,
          actual_count: actualCount,
          predicted_count: predictedCount,
          residual: residual,
          deviation_percent: deviationPercent,
          severity: severity,
          generated_at: new Date().toISOString()
        });
      }
    }
  }

  // 5. Insert anomalies
  if (anomalies.length > 0) {
    const anomalyTable = req.catalyst.datastore().table(constants.ANOMALY_TABLE);
    // Catalyst insertRows accepts an array of rows
    const BATCH_SIZE = 200;
    for (let i = 0; i < anomalies.length; i += BATCH_SIZE) {
      const chunk = anomalies.slice(i, i + BATCH_SIZE);
      await anomalyTable.insertRows(chunk);
    }
  }

  return { anomaliesFound: anomalies.length };
}

module.exports = {
  generateForecast,
  getForecasts,
  detectAnomalies,
};

