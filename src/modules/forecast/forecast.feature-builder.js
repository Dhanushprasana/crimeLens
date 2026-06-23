"use strict";

const constants = require("./forecast.constants");
const env = require("../../config/env");

function toDateKey(d) {
  return d.toISOString().slice(0, 10);
}

function weekOfYear(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

const logger = require("../../config/logger");

async function buildFeatures(req, options = {}) {
  const zcql = req.catalyst ? req.catalyst.zcql() : null;
  const table = req.catalyst
    ? req.catalyst.datastore().table(constants.TRAINING_TABLE)
    : null;

  if (!zcql) {
    return { error: "Catalyst ZCQL not available on req.catalyst" };
  }

  // Read source rows
  const sql = `SELECT district_id, police_station_id, crime_category_id, incident_registered_date, crime_count FROM ${env.TABLE_COMP_DISTRICT_CRIME_STATS} ORDER BY district_id, police_station_id, crime_category_id, incident_registered_date`;
  const rows = await zcql.executeZCQLQuery(sql);

  // Group by keys
  const groups = new Map();
  for (const r of rows || []) {
    const district_id = r.district_id || r["district_id"] || null;
    const police_station_id =
      r.police_station_id || r["police_station_id"] || null;
    const crime_category_id =
      r.crime_category_id || r["crime_category_id"] || null;
    const dateStr =
      r.incident_registered_date ||
      r["incident_registered_date"] ||
      r.crime_registered_date ||
      r["crime_registered_date"] ||
      null;
    const count = r.crime_count || r["crime_count"] || 0;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    const key = `${district_id}||${police_station_id}||${crime_category_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups
      .get(key)
      .push({
        date: d,
        count,
        district_id,
        police_station_id,
        crime_category_id,
      });
  }

  const inserted = [];
  const rowsToInsert = [];
  for (const [key, series] of groups.entries()) {
    // ensure sorted by date
    series.sort((a, b) => a.date - b.date);

    // Optionally fill missing dates with zero counts
    let filled = [];
    if (options && options.fillMissingDates) {
      const firstDate = new Date(series[0].date);
      const lastDate = new Date(series[series.length - 1].date);
      const byDate = new Map();
      for (const s of series) {
        byDate.set(toDateKey(s.date), s.count);
      }
      for (
        let d = new Date(firstDate);
        d <= lastDate;
        d.setDate(d.getDate() + 1)
      ) {
        const keyDate = toDateKey(d);
        const cnt = byDate.has(keyDate) ? byDate.get(keyDate) : 0;
        filled.push({
          date: new Date(d),
          count: cnt,
          district_id: series[0].district_id,
          police_station_id: series[0].police_station_id,
          crime_category_id: series[0].crime_category_id,
        });
      }
    } else {
      filled = series;
    }

    const counts = filled.map((s) => s.count);
    for (let i = 0; i < filled.length; i++) {
      const s = filled[i];
      const d = s.date;
      const day_of_week = d.getDay();
      const week_of_year = weekOfYear(d);
      const crime_month = d.getMonth() + 1;
      const crime_quarter = Math.floor(d.getMonth() / 3) + 1;
      const crime_year = d.getFullYear();

      const lag_1 = i - 1 >= 0 ? counts[i - 1] : null;
      const lag_7 = i - 7 >= 0 ? counts[i - 7] : null;
      const lag_30 = i - 30 >= 0 ? counts[i - 30] : null;

      const rolling_avg_7 = (function () {
        const start = Math.max(0, i - 6);
        const slice = counts.slice(start, i + 1);
        return slice.length
          ? slice.reduce((a, b) => a + b, 0) / slice.length
          : null;
      })();
      const rolling_avg_30 = (function () {
        const start = Math.max(0, i - 29);
        const slice = counts.slice(start, i + 1);
        return slice.length
          ? slice.reduce((a, b) => a + b, 0) / slice.length
          : null;
      })();

      const row = {
        district_id: s.district_id,
        police_station_id: s.police_station_id,
        crime_category_id: s.crime_category_id,
        crime_registered_date: toDateKey(d),
        crime_count: s.count,
        day_of_week,
        week_of_year,
        crime_month,
        crime_quarter,
        crime_year,
        lag_1,
        lag_7,
        lag_30,
        rolling_avg_7,
        rolling_avg_30,
      };

      // queue for batch insert
      rowsToInsert.push(row);
      inserted.push(row);
    }
  }

  // Batch insert in chunks for performance
  if (table && rowsToInsert.length) {
    const CHUNK_SIZE = 200;
    for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
      const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
      try {
        if (typeof table.insertRows === "function") {
          await table.insertRows(chunk);
          logger.info(
            `Inserted training batch ${i + 1}-${i + chunk.length} of ${rowsToInsert.length}`,
          );
        } else {
          // fallback to per-row inserts if insertRows not supported
          for (const r of chunk) await table.insertRow(r);
          logger.info(
            `Inserted training batch (row-by-row) ${i + 1}-${i + chunk.length} of ${rowsToInsert.length}`,
          );
        }
      } catch (err) {
        logger.warn("Batch insert failed, falling back to single inserts", {
          error: err && err.message ? err.message : err,
        });
        for (const r of chunk) {
          try {
            await table.insertRow(r);
          } catch (singleErr) {
            logger.warn("Failed to insert training row", {
              row: r,
              error:
                singleErr && singleErr.message ? singleErr.message : singleErr,
            });
          }
        }
      }
    }
  }

  return { inserted_count: inserted.length, sample: inserted.slice(0, 5) };
}

module.exports = { buildFeatures };
