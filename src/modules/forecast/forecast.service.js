"use strict";

const constants = require("./forecast.constants");
const logger = require("../../config/logger");
const generator = require("./forecast.generate");

/**
 * Generate predictions for a date range and store in database
 * Flow:
 * 1. Call Python service to generate ML predictions
 * 2. Build rows with prediction data
 * 3. Insert into FORECAST_TABLE
 * 4. Return summary
 */
async function generateAndStoreForecast(req, filters = {}) {
  try {
    const {
      start_date,
      end_date,
      district_id,
      police_station_id,
      crime_category_id,
    } = filters;

    logger.info("generateAndStoreForecast: building forecasts", {
      start_date,
      end_date,
      district_id,
      police_station_id,
      crime_category_id,
    });

    // 1. Generate predictions using the existing generator
    const generatedPredictions = await generator.generateForecast(req, {
      forecast_start: start_date,
      forecast_end: end_date,
    });

    // 2. Get datastore and forecast table
    const datastore = req.catalyst.datastore();
    const forecastTable = datastore.table(constants.FORECAST_TABLE);

    if (!forecastTable) {
      throw new Error(`Table ${constants.FORECAST_TABLE} not found`);
    }

    // 3. Read predictions from generated file and prepare for insertion
    const fs = require("fs");
    const path = require("path");
    const outputFilePath = path.join(__dirname, "forecast-predictions.json");

    let predictionRows = [];
    if (fs.existsSync(outputFilePath)) {
      const content = fs.readFileSync(outputFilePath, "utf8");
      predictionRows = JSON.parse(content);
      logger.info("Loaded predictions from file", {
        count: predictionRows.length,
      });
    }

    if (predictionRows.length === 0) {
      return {
        generated: 0,
        stored: 0,
        message: "No predictions generated",
      };
    }

    // 4. Filter predictions based on request filters
    let filteredRows = predictionRows;
    if (district_id) {
      filteredRows = filteredRows.filter((r) => r.district_id === district_id);
    }
    if (police_station_id) {
      filteredRows = filteredRows.filter(
        (r) => r.police_station_id === police_station_id,
      );
    }
    if (crime_category_id) {
      filteredRows = filteredRows.filter(
        (r) => r.crime_category_id === crime_category_id,
      );
    }

    // 5. Insert into database in batches
    const BATCH_SIZE = 500;
    let totalInserted = 0;

    for (let i = 0; i < filteredRows.length; i += BATCH_SIZE) {
      const batch = filteredRows.slice(i, i + BATCH_SIZE);
      try {
        if (typeof forecastTable.insertRows === "function") {
          await forecastTable.insertRows(batch);
        } else {
          for (const row of batch) {
            await forecastTable.insertRow(row);
          }
        }
        totalInserted += batch.length;
        logger.info(`Batch inserted: ${totalInserted}/${filteredRows.length}`);
      } catch (batchErr) {
        logger.error("Batch insert failed", {
          batchNumber: Math.floor(i / BATCH_SIZE) + 1,
          batchSize: batch.length,
          error: batchErr.message,
        });
        throw batchErr;
      }
    }

    logger.info("generateAndStoreForecast: completed successfully", {
      generated: predictionRows.length,
      stored: totalInserted,
    });

    return {
      generated: predictionRows.length,
      stored: totalInserted,
      message: `Successfully stored ${totalInserted} predictions`,
    };
  } catch (err) {
    logger.error("generateAndStoreForecast failed", {
      message: err.message,
      stack: err.stack,
    });
    throw err;
  }
}

/**
 * Fetch stored forecasts from database
 * Returns forecasts filtered by query parameters
 */
async function getForecasts(req, query = {}) {
  try {
    const zcql = req.catalyst ? req.catalyst.zcql() : null;

    if (!zcql) {
      logger.warn("ZCQL not available; returning no stored forecasts");
      return [];
    }

    if (
      query.start_date &&
      query.end_date &&
      query.start_date > query.end_date
    ) {
      throw Object.assign(
        new Error("start_date must be before or equal to end_date"),
        {
          status: 400,
        },
      );
    }

    const where = [];
    if (query.district_id) {
      where.push(
        `district_id = '${(query.district_id + "").replace(/'/g, "''")}'`,
      );
    }
    if (query.police_station_id) {
      where.push(
        `police_station_id = '${(query.police_station_id + "").replace(
          /'/g,
          "''",
        )}'`,
      );
    }
    if (query.crime_category_id) {
      where.push(
        `crime_category_id = '${(query.crime_category_id + "").replace(
          /'/g,
          "''",
        )}'`,
      );
    }
    if (query.start_date) {
      where.push(`forecast_date >= '${query.start_date}'`);
    }
    if (query.end_date) {
      where.push(`forecast_date <= '${query.end_date}'`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await zcql.executeZCQLQuery(
      `SELECT * FROM ${constants.FORECAST_TABLE} ${whereSql} ORDER BY forecast_date DESC LIMIT 500`,
    );

    // Catalyst returns ZCQL rows as { tableName: { ...columns } }.
    const normalizedRows = (rows || []).map((row) => {
      if (!row || typeof row !== "object") return row;
      const tableRow = row[constants.FORECAST_TABLE];
      return tableRow && typeof tableRow === "object" ? tableRow : row;
    });

    logger.info("getForecasts: returned rows", {
      count: normalizedRows.length,
    });
    return normalizedRows;
  } catch (err) {
    logger.error("getForecasts failed", {
      message: err.message,
      stack: err.stack,
    });
    if (err.status) throw err;
    // A failed read must not fabricate a forecast for another date.
    return [];
  }
}

/**
 * Detect anomalies by comparing actuals vs forecasts
 */
async function detectAnomalies(req, filters = {}) {
  const zcql = req.catalyst ? req.catalyst.zcql() : null;
  if (!zcql) throw new Error("Catalyst SDK not available");

  const env = require("../../config/env");

  // 1. Build dynamic WHERE clause
  const where = [];
  if (filters.start_date)
    where.push(`incident_registered_date >= '${filters.start_date}'`);
  if (filters.end_date)
    where.push(`incident_registered_date <= '${filters.end_date}'`);
  if (filters.district_id)
    where.push(`crime_happended_at_district_id = '${filters.district_id}'`);
  if (filters.police_station_id)
    where.push(`police_station_id = '${filters.police_station_id}'`);
  if (filters.crime_category_id)
    where.push(`crime_category_id = '${filters.crime_category_id}'`);

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
  const actuals = actualsResult.map((r) => r[env.TABLE_CRIME_INCIDENT]);

  // 3. Fetch matching forecasts
  const fcWhere = [];
  if (filters.start_date)
    fcWhere.push(`forecast_date >= '${filters.start_date}'`);
  if (filters.end_date) fcWhere.push(`forecast_date <= '${filters.end_date}'`);
  if (filters.district_id)
    fcWhere.push(`district_id = '${filters.district_id}'`);
  if (filters.police_station_id)
    fcWhere.push(`police_station_id = '${filters.police_station_id}'`);
  if (filters.crime_category_id)
    fcWhere.push(`crime_category_id = '${filters.crime_category_id}'`);

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
  const forecasts = fcResult.map((r) => r[constants.FORECAST_TABLE]);

  // 4. Compare and generate anomalies
  const anomalies = [];
  for (const act of actuals) {
    const actDist = act.crime_happended_at_district_id;
    const actStation = act.police_station_id;
    const actCat = act.crime_category_id;
    const actDate = act.incident_registered_date;
    const actualCount = act.actual_count || 0;

    // Find matching forecast
    const fc = forecasts.find(
      (f) =>
        f.district_id === actDist &&
        f.police_station_id === actStation &&
        f.crime_category_id === actCat &&
        f.forecast_date === actDate,
    );

    if (fc) {
      const predictedCount = parseFloat(fc.predicted_count) || 0;
      const residual = actualCount - predictedCount;
      const deviationPercent =
        predictedCount === 0
          ? actualCount > 0
            ? 100
            : 0
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
          generated_at: new Date().toISOString(),
        });
      }
    }
  }

  // 5. Insert anomalies
  if (anomalies.length > 0) {
    const anomalyTable = req.catalyst
      .datastore()
      .table(constants.ANOMALY_TABLE);
    const BATCH_SIZE = 200;
    for (let i = 0; i < anomalies.length; i += BATCH_SIZE) {
      const chunk = anomalies.slice(i, i + BATCH_SIZE);
      await anomalyTable.insertRows(chunk);
    }
  }

  return { anomaliesFound: anomalies.length };
}

module.exports = {
  generateAndStoreForecast,
  getForecasts,
  detectAnomalies,
};
