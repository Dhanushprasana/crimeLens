"use strict";

const constants = require("./forecast.constants");
const logger = require("../../config/logger");
const prediction = require("./forecast.prediction");

function daysBetweenInclusive(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  // clear time
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const diff = Math.round((e - s) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff + 1 : 0;
}

async function calibrate(
  req,
  { model_version, train_start, train_end, test_start, test_end } = {},
) {
  if (!model_version) throw new Error("model_version is required");
  if (!test_start || !test_end)
    throw new Error("test_start and test_end are required");

  const zcql = req.catalyst ? req.catalyst.zcql() : null;
  if (!zcql) throw new Error("Catalyst ZCQL not available");

  // 1) Fetch actuals from training table for test period, grouped by district/station/category/date
  const safeStart = test_start.replace(/'/g, "''");
  const safeEnd = test_end.replace(/'/g, "''");
  const sql = `SELECT district_id, police_station_id, crime_category_id, crime_registered_date, crime_count FROM ${constants.TRAINING_TABLE} WHERE crime_registered_date >= '${safeStart}' AND crime_registered_date <= '${safeEnd}' ORDER BY district_id, police_station_id, crime_category_id, crime_registered_date`;
  const rows = await zcql.executeZCQLQuery(sql);

  const actualMap = new Map(); // key -> count
  const groups = new Map(); // groupKey -> {district_id, police_station_id, crime_category_id}
  if (rows && rows.length) {
    for (const r of rows) {
      const rec = r[constants.TRAINING_TABLE] || r;
      const district_id = rec.district_id || rec.DISTRICT_ID || null;
      const police_station_id =
        rec.police_station_id || rec.POLICE_STATION_ID || null;
      const crime_category_id =
        rec.crime_category_id || rec.CRIME_CATEGORY_ID || null;
      const date = (
        rec.crime_registered_date ||
        rec.incident_registered_date ||
        ""
      ).slice(0, 10);
      const cnt = Number(rec.crime_count || 0);
      const groupKey = `${district_id}||${police_station_id}||${crime_category_id}`;
      const key = `${groupKey}||${date}`;
      actualMap.set(key, (actualMap.get(key) || 0) + cnt);
      if (!groups.has(groupKey))
        groups.set(groupKey, {
          district_id,
          police_station_id,
          crime_category_id,
        });
    }
  }

  const horizonDays = daysBetweenInclusive(test_start, test_end);
  const results = [];

  const table = req.catalyst
    ? req.catalyst.datastore().table(constants.CALIBRATION_TABLE)
    : null;

  // Lookup model name once
  let modelName = "QuickML";
  try {
    const safeVer = model_version.replace(/'/g, "''");
    const regRows = await zcql.executeZCQLQuery(
      `SELECT * FROM ${constants.MODEL_REGISTRY_TABLE} WHERE model_version = '${safeVer}' LIMIT 1`,
    );
    if (!regRows || !regRows.length) throw new Error("model_version not found");
    const r = regRows[0][constants.MODEL_REGISTRY_TABLE] || regRows[0];
    // ensure model status is COMPLETED
    const status = (r.status || r.STATUS || "").toString().toUpperCase();
    if (status !== "COMPLETED")
      throw new Error("Model not trained (status: " + status + ")");
    modelName = r.model_name || modelName;
  } catch (e) {
    logger.debug("Model registry lookup failed for calibration", {
      error: e && e.message ? e.message : e,
    });
    throw new Error(
      "Model not trained or not found: " + (e && e.message ? e.message : e),
    );
  }

  // 2) Build prediction rows for the entire test set and request batched predictions
  const featureSql = `SELECT * FROM ${constants.TRAINING_TABLE} WHERE crime_registered_date >= '${safeStart}' AND crime_registered_date <= '${safeEnd}' ORDER BY district_id, police_station_id, crime_category_id, crime_registered_date`;
  let featureRows = [];
  try {
    const fr = await zcql.executeZCQLQuery(featureSql);
    featureRows = fr || [];
  } catch (err) {
    logger.warn("Failed to read training table for prediction rows", {
      error: err && err.message ? err.message : err,
    });
    featureRows = [];
  }

  const predictionRows = [];
  for (const r of featureRows) {
    const rec = r[constants.TRAINING_TABLE] || r;
    const district_id = rec.district_id || rec.DISTRICT_ID || null;
    const police_station_id =
      rec.police_station_id || rec.POLICE_STATION_ID || null;
    const crime_category_id =
      rec.crime_category_id || rec.CRIME_CATEGORY_ID || null;
    const date = (
      rec.crime_registered_date ||
      rec.incident_registered_date ||
      rec.date ||
      ""
    ).slice(0, 10);
    if (!date) continue;
    // include original training row fields so QuickML has necessary features
    const row = Object.assign({}, rec, {
      district_id,
      police_station_id,
      crime_category_id,
      crime_registered_date: date,
    });
    predictionRows.push(row);
  }

  let allPreds = [];
  if (predictionRows.length) {
    try {
      allPreds = await prediction.predict(req, {
        predictionRows,
        batchSize: 5000,
      });
    } catch (err) {
      logger.warn("Bulk batch prediction failed during calibration", {
        error: err && err.message ? err.message : err,
      });
      allPreds = [];
    }
  }

  // Build a prediction map keyed by groupKey||date for fast lookup
  const globalPredMap = new Map();
  if (Array.isArray(allPreds) && allPreds.length) {
    for (const p of allPreds) {
      const district_id = p.district_id || p.DISTRICT_ID || null;
      const police_station_id =
        p.police_station_id || p.POLICE_STATION_ID || null;
      const crime_category_id =
        p.crime_category_id || p.CRIME_CATEGORY_ID || null;
      const date = (
        p.forecast_date ||
        p.crime_registered_date ||
        p.date ||
        ""
      ).slice(0, 10);
      const cnt = Number(
        p.predicted_count != null ? p.predicted_count : p.crime_count || 0,
      );
      if (!date) continue;
      const gk = `${district_id}||${police_station_id}||${crime_category_id}||${date}`;
      globalPredMap.set(gk, (globalPredMap.get(gk) || 0) + cnt);
    }
  }

  for (const [groupKey, groupVals] of groups.entries()) {
    const { district_id, police_station_id, crime_category_id } = groupVals;
    let predMap = new Map();

    // If we have global predictions with grouping, use them
    if (globalPredMap.size) {
      // populate predMap for this group from globalPredMap
      const start = new Date(test_start);
      const end = new Date(test_end);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const date = d.toISOString().slice(0, 10);
        const gk = `${district_id}||${police_station_id}||${crime_category_id}||${date}`;
        if (globalPredMap.has(gk)) predMap.set(date, globalPredMap.get(gk));
      }
    } else {
      // fallback to per-group prediction call (slower)
      let preds = [];
      try {
        preds = await prediction.predict(req, {
          startDate: test_start,
          horizonDays,
          contextRows: [
            {
              district_id,
              police_station_id,
              crime_category_id,
            },
          ],
        });
      } catch (err) {
        logger.warn("Prediction failed for group during calibration", {
          groupKey,
          error: err && err.message ? err.message : err,
        });
      }
      if (Array.isArray(preds)) {
        for (const p of preds) {
          const date = (p.forecast_date || p.crime_registered_date || "").slice(
            0,
            10,
          );
          const cnt = Number(
            p.predicted_count != null ? p.predicted_count : p.crime_count || 0,
          );
          if (!date) continue;
          predMap.set(date, (predMap.get(date) || 0) + cnt);
        }
      }
    }

    // Compute metrics for dates present in actualMap for this group
    let mae = 0,
      mse = 0,
      mapeSum = 0,
      mapeCount = 0,
      count = 0;

    // iterate dates between test_start and test_end to ensure consistent ordering
    const start = new Date(test_start);
    const end = new Date(test_end);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      const aKey = `${groupKey}||${date}`;
      if (!actualMap.has(aKey)) continue;
      const a = Number(actualMap.get(aKey) || 0);
      const p = Number(predMap.get(date) || 0);
      const err = Math.abs(a - p);
      mae += err;
      mse += (a - p) * (a - p);
      if (a !== 0) {
        mapeSum += Math.abs((a - p) / a) * 100;
        mapeCount++;
      }
      count++;
    }

    const total_predictions = count;
    const finalMae = count ? +(mae / count).toFixed(4) : null;
    const finalRmse = count ? +Math.sqrt(mse / count).toFixed(4) : null;
    const finalMape = mapeCount ? +(mapeSum / mapeCount).toFixed(2) : null;

    const status =
      total_predictions && total_predictions > 0 ? "SUCCESS" : "FAILED";
    const notes = `Calibration for group ${groupKey} using actuals from ${test_start} to ${test_end}`;

    const payload = {
      model_version,
      model_name: modelName,
      train_start: train_start || null,
      train_end: train_end || null,
      test_start,
      test_end,
      mae: finalMae,
      rmse: finalRmse,
      mape: finalMape,
      total_predictions,
      forecast_horizon_days: horizonDays,
      status,
      notes,
      district_id,
      police_station_id,
      crime_category_id,
      created_at: new Date().toISOString(),
    };

    try {
      if (table) await table.insertRow(payload);
    } catch (err) {
      logger.warn("Failed to persist calibration result for group", {
        groupKey,
        error: err && err.message ? err.message : err,
      });
    }
    results.push(payload);
  }

  return { total_groups: results.length, results };
}

module.exports = { calibrate };
