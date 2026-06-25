"use strict";

const service = require("./forecast.service");

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

module.exports = {
  buildTrainingData,
  calibrateModel,
  trainModel,
  generateForecast,
  getForecasts,
  getCalibrationReport,
};

