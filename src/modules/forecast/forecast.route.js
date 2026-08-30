"use strict";

const express = require("express");
const router = express.Router();
const controller = require("./forecast.controller");

// Generate predictions for a date range and store in DB
router.post("/generate-and-store", controller.generateAndStoreForecast);

// Fetch stored forecasts from database
router.get("/", controller.getForecasts);

// Detect anomalies by comparing actuals vs forecasts
router.post("/anomaly-detection", controller.detectAnomalies);

module.exports = router;
