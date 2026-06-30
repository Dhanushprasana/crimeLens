"use strict";

const fs = require("fs");
const path = require("path");
const constants = require("./forecast.constants");
const prediction = require("./forecast.prediction");
const logger = require("../../config/logger");
const combinations = require("./forecast-data/forecast-combinations.json");

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
    batchSize,
  });

  const predictionRows = [];
  const dates = getForecastDates(30);

  logger.info("generateForecast: preparing prediction rows");
  for (const combo of combinations) {
    for (const d of dates) {
      predictionRows.push({
        district_name: combo.district_name,
        police_station_name: combo.police_station_name,
        crime_category_name: combo.crime_category_name,
        crime_registered_date: d.toISOString().slice(0, 10),
        day_of_week: d.getDay(),
        week_of_year: weekOfYear(d),
        crime_month: d.getMonth() + 1,
        crime_quarter: Math.floor(d.getMonth() / 3) + 1,
        crime_year: d.getFullYear(),
        district_id: combo.district_id,
        police_station_id: combo.police_station_id,
        crime_category_id: combo.crime_category_id,
      });
    }
  }

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
      // Handle the output structure based on QuickML format
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

    /*
    const table = req.catalyst.datastore().table(constants.FORECAST_TABLE);
    if (table && resultRows.length) {
      try {
        if (typeof table.insertRows === "function") {
          await table.insertRows(resultRows);
        } else {
          for (const r of resultRows) await table.insertRow(r);
        }
        logger.info(`Inserted forecast batch of size ${resultRows.length}`);
      } catch (err) {
        logger.error("Batch insert failed for forecast", { error: err.message });
      }
    }
    */
  }

  // Store the predictions in a json file for now
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
