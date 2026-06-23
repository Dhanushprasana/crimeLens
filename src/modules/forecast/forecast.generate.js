"use strict";

const constants = require("./forecast.constants");
const prediction = require("./forecast.prediction");

async function generateForecast(
  req,
  {
    model_version,
    forecast_start,
    forecast_end,
    batchSize = 5000,
  },
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

    for (
      let d = new Date(start);
      d <= end;
      d.setDate(d.getDate() + 1)
    ) {
      predictionRows.push({
        district_id: data.district_id,
        police_station_id: data.police_station_id,
        crime_category_id: data.crime_category_id,

        crime_registered_date: d.toISOString().slice(0, 10),
      });
    }
  }

  const predictions = await prediction.predict(req, {
    predictionRows,
    batchSize,
  });

  const table = req.catalyst
    .datastore()
    .table(constants.FORECAST_TABLE);

  for (const pred of predictions) {
    await table.insertRow({
      district_id: pred.district_id,
      police_station_id: pred.police_station_id,
      crime_category_id: pred.crime_category_id,

      forecast_date: pred.forecast_date,

      predicted_count: pred.predicted_count,

      model_version,

      generated_at: new Date().toISOString(),
    });
  }

  return {
    generated: predictions.length,
  };
}

module.exports = {
  generateForecast,
};