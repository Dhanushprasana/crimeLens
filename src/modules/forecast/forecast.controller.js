"use strict";

const service = require("./forecast.service");
const fs = require("fs");
const path = require("path");
const logger = require("../../config/logger");

/**
 * Generate predictions for a date range and store in database
 * POST /forecast/generate-and-store
 */
async function generateAndStoreForecast(req, res, next) {
  try {
    logger.info("generateAndStoreForecast endpoint hit", {
      body: req.body,
    });
    const {
      start_date,
      end_date,
      district_id,
      police_station_id,
      crime_category_id,
    } = req.body || {};

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: "start_date and end_date are required",
      });
    }

    const result = await service.generateAndStoreForecast(req, {
      start_date,
      end_date,
      district_id,
      police_station_id,
      crime_category_id,
    });

    logger.info("generateAndStoreForecast completed successfully", { result });
    return res.status(200).json({
      success: true,
      message: "Predictions generated and stored successfully",
      result,
    });
  } catch (err) {
    logger.error("generateAndStoreForecast failed", {
      message: err.message,
      stack: err.stack,
      code: err.code,
    });
    next(err);
  }
}

/**
 * Fetch stored forecasts from database
 * GET /forecast
 */
async function getForecasts(req, res, next) {
  try {
    const result = await service.getForecasts(req, req.query || {});
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error("getForecasts failed", {
      message: err.message,
      stack: err.stack,
    });
    next(err);
  }
}

/**
 * Detect anomalies by comparing actuals vs forecasts
 * POST /forecast/anomaly-detection
 */
async function detectAnomalies(req, res, next) {
  try {
    const result = await service.detectAnomalies(req, req.body || {});
    return res.status(200).json({ success: true, result });
  } catch (err) {
    logger.error("detectAnomalies failed", {
      message: err.message,
      stack: err.stack,
    });
    next(err);
  }
}

module.exports = {
  generateAndStoreForecast,
  getForecasts,
  detectAnomalies,
};
