"use strict";

const fs = require("fs");
const path = require("path");
const constants = require("./forecast.constants");
const prediction = require("./forecast.prediction");
const logger = require("../../config/logger");
const combinations = require("./forecast-data/forecast-combinations.json");

let cachedUniqueCombos = null;

async function getUniqueCombinations() {
  if (cachedUniqueCombos) return cachedUniqueCombos;

  const readline = require("readline");
  const csvPath = path.join(__dirname, "forecast-data", "crime_incident_training_data_filtered.csv");
  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const combinationsSet = new Set();
  const combinationsList = [];
  let isHeader = true;

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    const parts = line.split(',');
    const dist = parts[0];
    const ps = parts[1];
    const cat = parts[2];
    if (dist && ps && cat) {
      const key = `${dist}|${ps}|${cat}`;
      if (!combinationsSet.has(key)) {
        combinationsSet.add(key);
        combinationsList.push({
          district_name: dist,
          police_station_name: ps,
          crime_category_name: cat
        });
      }
    }
  }

  cachedUniqueCombos = combinationsList;
  return cachedUniqueCombos;
}

function getDatesInRange(startDateStr, endDateStr) {
  const dates = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  let current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

async function loadMetadata(req) {
  const zcql = req.catalyst ? req.catalyst.zcql() : null;
  if (!zcql) {
    return { districts: {}, stations: {}, categories: {} };
  }
  const env = require("../../config/env");

  try {
    const [distResult, stationResult, catResult] = await Promise.all([
      zcql.executeZCQLQuery(`SELECT ROWID, district_name FROM ${env.TABLE_DISTRICT_GEODATA}`),
      zcql.executeZCQLQuery(`SELECT ROWID, station_name FROM ${env.TABLE_POLICE_STATION}`),
      zcql.executeZCQLQuery(`SELECT ROWID, crime_category_name FROM ${env.TABLE_CRIME_CATEGORY}`)
    ]);

    const districts = {};
    for (const r of distResult) {
      const row = r[env.TABLE_DISTRICT_GEODATA] || r;
      if (row.district_name) {
        districts[row.district_name.toLowerCase().trim()] = row.ROWID;
      }
    }

    const stations = {};
    for (const r of stationResult) {
      const row = r[env.TABLE_POLICE_STATION] || r;
      if (row.station_name) {
        stations[row.station_name.toLowerCase().trim()] = row.ROWID;
      }
    }

    const categories = {};
    for (const r of catResult) {
      const row = r[env.TABLE_CRIME_CATEGORY] || r;
      if (row.crime_category_name) {
        categories[row.crime_category_name.toLowerCase().trim()] = row.ROWID;
      }
    }

    return { districts, stations, categories };
  } catch (err) {
    logger.error("Failed to load metadata maps", { error: err.message });
    return { districts: {}, stations: {}, categories: {} };
  }
}

function getForecastDates(days) {
  const dates = [];
  const today = new Date();
  for (let i = 1; i <= days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function weekOfYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function generateForecast(
  req,
  { model_version = "V1", forecast_start, forecast_end, batchSize = 500 }
) {
  logger.info("generateForecast: start", {
    model_version,
    forecast_start,
    forecast_end,
    batchSize,
  });

  const predictionRows = [];
  
  let dates;
  if (forecast_start && forecast_end) {
    dates = getDatesInRange(forecast_start, forecast_end);
  } else {
    dates = getForecastDates(30);
  }

  logger.info("generateForecast: preparing unique combinations from CSV");
  const uniqueCombos = await getUniqueCombinations();

  logger.info("generateForecast: loading metadata maps");
  const metadata = await loadMetadata(req);

  const combinationsToSave = [];

  logger.info("generateForecast: preparing prediction rows");
  for (const combo of uniqueCombos) {
    const distKey = combo.district_name.toLowerCase().trim();
    const stationKey = combo.police_station_name.toLowerCase().trim();
    const catKey = combo.crime_category_name.toLowerCase().trim();

    const district_id = metadata.districts[distKey] || null;
    const police_station_id = metadata.stations[stationKey] || null;
    const crime_category_id = metadata.categories[catKey] || null;

    for (const d of dates) {
      const dateStr = d.toISOString().slice(0, 10);
      
      combinationsToSave.push({
        district_name: combo.district_name,
        police_station_name: combo.police_station_name,
        crime_category_name: combo.crime_category_name,
        date: dateStr,
      });

      predictionRows.push({
        district_name: combo.district_name,
        police_station_name: combo.police_station_name,
        crime_category_name: combo.crime_category_name,
        crime_registered_date: dateStr,
        day_of_week: d.getDay(),
        week_of_year: weekOfYear(d),
        crime_month: d.getMonth() + 1,
        crime_quarter: Math.floor(d.getMonth() / 3) + 1,
        crime_year: d.getFullYear(),
        district_id,
        police_station_id,
        crime_category_id,
      });
    }
  }

  // Save the combinations to forecast-combinations.json
  const comboFilePath = path.join(__dirname, "forecast-data", "forecast-combinations.json");
  fs.writeFileSync(comboFilePath, JSON.stringify(combinationsToSave, null, 2), "utf8");

  logger.info("generateForecast: combinations saved", {
    combinationsCount: combinationsToSave.length,
    comboFilePath,
  });

  logger.info("generateForecast: predictionRows prepared", {
    predictionRows: predictionRows.length,
  });

  const BATCH_SIZE = batchSize || 500;
  const allResultRows = [];

  for (let i = 0; i < predictionRows.length; i += BATCH_SIZE) {
    const batch = predictionRows.slice(i, i + BATCH_SIZE);
    logger.info(`generateForecast: processing batch ${Math.floor(i / BATCH_SIZE) + 1}`, {
      batchSize: batch.length,
    });

    let predictions;
    try {
      predictions = await prediction.predict(req, {
        model_version,
        predictionRows: batch,
        batchSize: BATCH_SIZE
      });
    } catch (err) {
      logger.error("Forecast prediction failed for batch", {
        error: err && err.message ? err.message : err,
      });
      throw err;
    }

    const resultRows = [];
    for (let j = 0; j < batch.length; j++) {
      let p = null;
      if (predictions && predictions[j]) {
        p = predictions[j].predicted_count ?? predictions[j].prediction ?? predictions[j].score ?? predictions[j].value ?? null;
      }

      resultRows.push({
        district_id: batch[j].district_id,
        police_station_id: batch[j].police_station_id,
        crime_category_id: batch[j].crime_category_id,
        forecast_date: batch[j].crime_registered_date,
        predicted_count: p,
        model_version: model_version,
        generated_at: new Date().toISOString(),
      });
    }

    allResultRows.push(...resultRows);
  }

  const outputFilePath = path.join(__dirname, "forecast-predictions.json");
  fs.writeFileSync(outputFilePath, JSON.stringify(allResultRows, null, 2), "utf8");

  logger.info("generateForecast: completed", {
    generated: allResultRows.length,
    outputFile: outputFilePath
  });

  return {
    generated: allResultRows.length,
    message: `Predictions saved to ${outputFilePath}`
  };
}

module.exports = {
  generateForecast,
};
