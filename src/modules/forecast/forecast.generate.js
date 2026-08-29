"use strict";

const fs = require("fs");
const path = require("path");
const constants = require("./forecast.constants");
const logger = require("../../config/logger");
const combinations = require("./forecast-combinations.json");

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

function getDatesBetween(start, end) {
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function weekOfYear(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

async function generateForecast(
  req,
  { model_version = "V1", forecast_start, forecast_end, batchSize = 500 },
) {
  logger.info("generateForecast: start", {
    model_version,
    batchSize,
  });

  const predictionRows = [];
  const startDate = forecast_start ? new Date(forecast_start) : null;
  const endDate = forecast_end ? new Date(forecast_end) : null;
  const dates =
    startDate &&
    endDate &&
    !Number.isNaN(startDate.getTime()) &&
    !Number.isNaN(endDate.getTime())
      ? getDatesBetween(startDate, endDate)
      : getForecastDates(30);

  logger.info("generateForecast: preparing prediction rows");
  logger.info("Combinations loaded", {
    count: combinations ? combinations.length : 0,
    isArray: Array.isArray(combinations),
  });

  try {
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
  } catch (loopErr) {
    logger.error("Error building prediction rows", {
      message: loopErr.message,
      stack: loopErr.stack,
    });
    throw loopErr;
  }

  logger.info("generateForecast: predictionRows prepared", {
    predictionRows: predictionRows.length,
  });

  const BATCH_SIZE = batchSize || 500;
  const allResultRows = [];

  for (let i = 0; i < predictionRows.length; i += BATCH_SIZE) {
    const batch = predictionRows.slice(i, i + BATCH_SIZE);
    logger.info(
      `generateForecast: processing batch ${Math.floor(i / BATCH_SIZE) + 1}`,
      {
        batchSize: batch.length,
      },
    );

    try {
      // QuickML has been removed, generate mock predictions for testing
      const predictions = batch.map(() => ({
        predicted_count: Math.floor(Math.random() * 10),
      }));
    } catch (err) {
      logger.error("Forecast prediction failed for batch", {
        error: err && err.message ? err.message : err,
        stack: err.stack,
        batchNumber: Math.floor(i / BATCH_SIZE) + 1,
      });
      throw err;
    }

    const resultRows = [];
    for (let j = 0; j < batch.length; j++) {
      let p = null;
      if (predictions && predictions[j]) {
        p = predictions[j].predicted_count ?? null;
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
  fs.writeFileSync(
    outputFilePath,
    JSON.stringify(allResultRows, null, 2),
    "utf8",
  );

  logger.info("generateForecast: completed", {
    generated: allResultRows.length,
    outputFile: outputFilePath,
  });

  return {
    generated: allResultRows.length,
    message: `Predictions saved to ${outputFilePath}`,
  };
}

module.exports = {
  generateForecast,
};
