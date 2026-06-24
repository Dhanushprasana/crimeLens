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
  logger.info("buildFeatures: start", { options });

  const zcql = req.catalyst ? req.catalyst.zcql() : null;
  const table = req.catalyst
    ? req.catalyst.datastore().table(constants.TRAINING_TABLE)
    : null;

  if (!zcql) {
    logger.warn("buildFeatures: Catalyst ZCQL not available on req.catalyst");
    return { error: "Catalyst ZCQL not available on req.catalyst" };
  }

  // Read source rows using Datastore pagination to avoid ZCQL default limits
  let rows = [];
  try {
    const datastore = req.catalyst.datastore();
    const srcTable = datastore.table(env.TABLE_COMP_DISTRICT_CRIME_STATS);
    let nextToken = undefined;
    do {
      const paged = await srcTable.getPagedRows({ nextToken, maxRows: 200 });
      const pageRows = (paged && (paged.data || paged.rows)) || [];
      if (pageRows && pageRows.length) rows.push(...pageRows);
      logger.info("buildFeatures: fetched page rows", {
        page: pageRows.length,
        accumulated: rows.length,
        nextToken: paged ? paged.next_token || paged.nextToken : undefined,
      });
      nextToken = paged ? paged.next_token || paged.nextToken : undefined;
    } while (nextToken);
    logger.info("buildFeatures: fetched source rows", {
      rows: rows.length,
    });
  } catch (err) {
    logger.error("buildFeatures: failed to fetch source rows", {
      error: err && err.message ? err.message : String(err),
    });
    throw err;
  }

  // Group by keys
  const groups = new Map();
  if (rows && rows.length > 0) {
    logger.debug &&
      logger.debug("buildFeatures: sample source row", { sample: rows[0] });
  }
  for (const r of rows || []) {
    const rec = r[env.TABLE_COMP_DISTRICT_CRIME_STATS] || r;
    const district_id = rec.district_id || rec["district_id"] || null;
    const police_station_id =
      rec.police_station_id || rec["police_station_id"] || null;
    const crime_category_id =
      rec.crime_category_id || rec["crime_category_id"] || null;
    const dateStr =
      rec.incident_registered_date ||
      rec["incident_registered_date"] ||
      rec.crime_registered_date ||
      rec["crime_registered_date"] ||
      null;
    const count = rec.crime_count || rec["crime_count"] || 0;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    const key = `${district_id}||${police_station_id}||${crime_category_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      date: d,
      count,
      district_id,
      police_station_id,
      crime_category_id,
    });
  }

  logger.info("buildFeatures: grouped source rows", { groups: groups.size });

  const rowsToInsert = [];
  let successCount = 0;
  const successRows = [];
  const failedRows = [];
  for (const [key, series] of groups.entries()) {
    // ensure sorted by date
    series.sort((a, b) => a.date - b.date);

    // Optionally fill missing dates with zero counts
    let filled = [];
    if (options && options.fillMissingDates) {
      logger.debug &&
        logger.debug(`buildFeatures: filling missing dates for group ${key}`);
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

      // Coerce numeric fields to proper Number/null types to match datastore schema
      const toNum = (v) => {
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      //   const toNumId = (v) => {
      //     if (v === null || v === undefined || v === "") return null;
      //     // keep long numeric-looking ids as strings to avoid JS precision loss
      //     if (typeof v === "string" && v.length >= 15) return v;
      //     const n = Number(v);
      //     return Number.isFinite(n) ? n : v;
      //   };
      const toFk = (v) => {
        if (v === null || v === undefined) return null;
        return String(v);
      };

      const row = {
        district_id: toFk(s.district_id),
        police_station_id: toFk(s.police_station_id),
        crime_category_id: toFk(s.crime_category_id),
        // use a Date object for the datastore date column to match table date type
        crime_registered_date: new Date(toDateKey(d)),
        crime_count: toNum(s.count) || 0,
        day_of_week: toNum(day_of_week) || 0,
        week_of_year: toNum(week_of_year) || 0,
        crime_month: toNum(crime_month) || 0,
        crime_quarter: toNum(crime_quarter) || 0,
        crime_year: toNum(crime_year) || 0,
        lag_1: toNum(lag_1),
        lag_7: toNum(lag_7),
        lag_30: toNum(lag_30),
        rolling_avg_7: toNum(rolling_avg_7),
        rolling_avg_30: toNum(rolling_avg_30),
      };

      // queue for batch insert
      rowsToInsert.push(row);
    }
  }
  logger.info("buildFeatures: prepared training rows", {
    rowsToInsert: rowsToInsert.length,
  });

  // Batch insert in chunks for performance
  if (table && rowsToInsert.length) {
    const CHUNK_SIZE = 200;
    logger.info("buildFeatures: starting batch insert", {
      targetTable: constants.TRAINING_TABLE,
      totalRows: rowsToInsert.length,
      chunkSize: CHUNK_SIZE,
    });
    for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
      const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
      try {
        if (typeof table.insertRows === "function") {
          await table.insertRows(chunk);
          successCount += chunk.length;
          successRows.push(...chunk);
          logger.info(
            `Inserted training batch ${i + 1}-${i + chunk.length} of ${rowsToInsert.length}`,
          );
        } else {
          // fallback to per-row inserts if insertRows not supported
          for (const r of chunk) {
            await table.insertRow(r);
            successCount++;
            successRows.push(r);
          }
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
            successCount++;
            successRows.push(r);
          } catch (singleErr) {
            failedRows.push(r);
            // Prepare lightweight field diagnostics to avoid huge logs
            const fieldDiagnostics = {};
            try {
              for (const k of Object.keys(r)) {
                const v = r[k];
                fieldDiagnostics[k] = {
                  type:
                    v === null ? "null" : Array.isArray(v) ? "array" : typeof v,
                };
                if (typeof v === "string")
                  fieldDiagnostics[k].length = v.length;
              }
            } catch (diagErr) {
              // ignore diagnostics failure
            }
            logger.warn("Failed to insert training row", {
              row: r,
              error:
                singleErr && singleErr.message ? singleErr.message : singleErr,
              errorObject: singleErr,
              fieldDiagnostics,
            });
          }
        }
      }
    }
  }

  const totalPrepared = rowsToInsert.length;
  const failedCount = totalPrepared - successCount;
  logger.info("buildFeatures: completed", {
    inserted_count: successCount,
    failed_count: failedCount,
  });
  return {
    inserted_count: successCount,
    failed_count: failedCount,
    sample: successRows.slice(0, 5),
    failed_sample: failedRows.slice(0, 5),
  };
}

module.exports = { buildFeatures };
