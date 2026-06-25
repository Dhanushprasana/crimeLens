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

module.exports = {
  generateForecast,
  getForecasts,
};

