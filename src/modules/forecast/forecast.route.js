"use strict";

const express = require("express");
const router = express.Router();
const controller = require("./forecast.controller");

router.post("/build-training-data", controller.buildTrainingData);
router.post("/calibrate", controller.calibrateModel);
router.post("/generate", controller.generateForecast);
router.post("/train", controller.trainModel);

router.get("/", controller.getForecasts);
router.get("/calibration", controller.getCalibrationReport);

module.exports = router;
