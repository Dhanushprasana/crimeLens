"use strict";

const constants = require("./forecast.constants");
const logger = require("../../config/logger");

async function predict(
  req,
  { startDate, horizonDays = 30, contextRows = [] } = {},
) {
  // Try to use Catalyst QuickML if available on req.catalyst
  // Use QuickML client and surface errors (no graceful fallback)
  const quickml = req.catalyst
    ? req.catalyst.quickml || req.catalyst.quickML
    : null;
  const client = quickml && typeof quickml === "function" ? quickml() : quickml;
  if (!client) {
    const msg = "QuickML client not available on req.catalyst";
    logger.error(msg);
    throw new Error(msg);
  }

  const tryMethods = [
    "predict",
    "predictModel",
    "predictFromModel",
    "predict_batch",
  ];
  let lastErr = null;
  for (const m of tryMethods) {
    if (typeof client[m] === "function") {
      try {
        const preds = await client[m]({
          startDate,
          horizonDays,
          contextRows,
          table: constants.TRAINING_TABLE,
        });
        if (Array.isArray(preds)) return preds;
        if (preds && preds.predictions) return preds.predictions;
      } catch (err) {
        lastErr = err;
        logger.error(`QuickML.${m} failed`, {
          error: err && err.message ? err.message : err,
        });
      }
    }
  }
  const failMsg = lastErr
    ? `QuickML predict failed: ${lastErr.message || lastErr}`
    : "No QuickML predict method found";
  logger.error(failMsg);
  throw new Error(failMsg);

  // Fallback: synthesize a simple fake forecast sequence starting at startDate
  const results = [];
  const start = startDate ? new Date(startDate) : new Date();
  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    results.push({
      forecast_date: d.toISOString().slice(0, 10),
      predicted_count: Math.round(10 + Math.random() * 10),
    });
  }
  return results;
}

module.exports = { predict };
