"use strict";

const service = require("./forecast.service");
const fs = require("fs");
const path = require("path");
const logger = require("../../config/logger");


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

module.exports = {
  generateForecast,
  getForecasts,
};
