"use strict";

const constants = require("./forecast.constants");
const prediction = require("./forecast.prediction");
const logger = require("../../config/logger");

async function generateForecast(
  req,
  { model_version, forecast_start, forecast_end, batchSize = 5000 },
) {
  const zcql = req.catalyst.zcql();

  const rows = await zcql.executeZCQLQuery(`
    SELECT DISTINCT
      district_id,
      police_station_id,
      crime_category_id
    FROM ${constants.TRAINING_TABLE}
  `);

  const predictionRows = [];

  const start = new Date(forecast_start);
  const end = new Date(forecast_end);

  for (const row of rows) {
    const data = row[constants.TRAINING_TABLE] || row;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      predictionRows.push({
        district_id: data.district_id,
        police_station_id: data.police_station_id,
        crime_category_id: data.crime_category_id,

        crime_registered_date: d.toISOString().slice(0, 10),
      });
    }
  }

  let predictions;
  try {
    predictions = await prediction.predict(req, {
      predictionRows,
      batchSize,
    });
  } catch (err) {
    logger.error("Forecast prediction failed", {
      error: err && err.message ? err.message : err,
    });
    throw err;
  }

  const table = req.catalyst.datastore().table(constants.FORECAST_TABLE);

  // Map predictions to datastore rows with defensive field mapping
  const rowsToInsert = (predictions || []).map((pred) => {
    const forecast_date =
      pred.forecast_date ||
      pred.crime_registered_date ||
      pred.date ||
      pred.forecastDate ||
      null;
    const predicted_count =
      pred.predicted_count ??
      pred.prediction ??
      pred.score ??
      pred.value ??
      null;

    return {
      district_id: pred.district_id,
      police_station_id: pred.police_station_id,
      crime_category_id: pred.crime_category_id,

      forecast_date,

      predicted_count,

      model_version,

      generated_at: new Date().toISOString(),
    };
  });

  // Batch insert in chunks for performance, fallback to per-row inserts
  if (table && rowsToInsert.length) {
    const CHUNK_SIZE = 200;
    for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
      const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
      try {
        if (typeof table.insertRows === "function") {
          await table.insertRows(chunk);
          logger.info(
            `Inserted forecast batch ${i + 1}-${i + chunk.length} of ${rowsToInsert.length}`,
          );
        } else {
          for (const r of chunk) await table.insertRow(r);
          logger.info(
            `Inserted forecast batch (row-by-row) ${i + 1}-${i + chunk.length} of ${rowsToInsert.length}`,
          );
        }
      } catch (err) {
        logger.warn(
          "Batch insert failed for forecast, falling back to single inserts",
          {
            error: err && err.message ? err.message : err,
          },
        );
        for (const r of chunk) {
          try {
            await table.insertRow(r);
          } catch (singleErr) {
            logger.warn("Failed to insert forecast row", {
              row: r,
              error:
                singleErr && singleErr.message ? singleErr.message : singleErr,
            });
          }
        }
      }
    }
  }

  return {
    generated: rowsToInsert.length,
  };
}

module.exports = {
  generateForecast,
};
