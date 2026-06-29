"use strict";

const express = require("express");
const router = express.Router();
const controller = require("./forecast.controller");

router.post("/generate", controller.generateForecast);
router.post("/anomaly-detection", controller.detectAnomalies);
router.get("/anomaly-detection", controller.getAnomalies);

router.get("/", controller.getForecasts);

module.exports = router;
