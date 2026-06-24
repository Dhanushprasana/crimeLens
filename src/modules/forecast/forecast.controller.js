"use strict";

const service = require("./forecast.service");
const fs = require("fs");
const path = require("path");
const logger = require("../../config/logger");

async function buildTrainingData(req, res, next) {
  try {
    const result = await service.buildTrainingDataset(req, req.body || {});
    return res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

async function calibrateModel(req, res, next) {
  try {
    const result = await service.calibrateModel(req, req.body || {});
    return res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

async function trainModel(req, res, next) {
  try {
    const payload = req.body || {};
    const result = await service.trainModel(req, payload);
    return res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

async function generateForecast(req, res, next) {
  try {
    const result = await service.generateForecast(req, req.body || {});
    return res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

async function getForecasts(req, res, next) {
  try {
    const result = await service.getForecasts(req, req.query || {});
    return res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

async function getCalibrationReport(req, res, next) {
  try {
    const result = await service.getCalibrationReport(req, req.query || {});
    return res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

async function exportTrainingCsv(req, res, next) {
  try {
    const out = await service.exportTrainingCsv(req);
    // ensure local forecast-data directory exists inside the project
    const outDir = path.join(
      process.cwd(),
      "src",
      "modules",
      "forecast",
      "forecast-data",
    );
    try {
      fs.mkdirSync(outDir, { recursive: true });
    } catch (e) {
      // ignore mkdir errors
    }
    const filePath = path.join(outDir, out.filename);
    fs.writeFileSync(filePath, out.csv, "utf8");
    logger &&
      logger.info &&
      logger.info("exportTrainingCsv: saved file", {
        filePath,
        rows: out.rows,
      });
    return res.status(200).json({ success: true, filePath, rows: out.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  buildTrainingData,
  calibrateModel,
  trainModel,
  generateForecast,
  getForecasts,
  getCalibrationReport,
  exportTrainingCsv,
};
