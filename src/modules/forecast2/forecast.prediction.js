"use strict";

const constants = require("./forecast.constants");
const logger = require("../../config/logger");

async function predict(
  req,
  {
    startDate,
    horizonDays = 30,
    contextRows = [],
    predictionRows = [],
    batchSize = 5000,
  } = {},
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
    "predictBatch",
    "batchPredict",
    "predictRows",
  ];
  let lastErr = null;

  // If predictionRows provided, attempt batched calls
  if (Array.isArray(predictionRows) && predictionRows.length) {
    const out = [];
    for (let i = 0; i < predictionRows.length; i += batchSize) {
      const batch = predictionRows.slice(i, i + batchSize);
      let batchPreds = null;
      for (const m of tryMethods) {
        if (typeof client[m] === "function") {
          try {
            // Try common payload shapes
            const tryPayloads = [
              { rows: batch, table: constants.TRAINING_TABLE },
              { data: batch, table: constants.TRAINING_TABLE },
              batch,
            ];
            for (const payload of tryPayloads) {
              try {
                const r = await client[m](payload);
                if (Array.isArray(r)) {
                  batchPreds = r;
                  break;
                }
                if (r && Array.isArray(r.predictions)) {
                  batchPreds = r.predictions;
                  break;
                }
                if (r && Array.isArray(r.rows)) {
                  batchPreds = r.rows;
                  break;
                }
              } catch (err) {
                // try next payload shape
                lastErr = err;
              }
            }
            if (batchPreds) break;
          } catch (err) {
            lastErr = err;
            logger.error(`QuickML.${m} failed (batch)`, {
              error: err && err.message ? err.message : err,
            });
          }
        }
      }
      if (!batchPreds) {
        const failMsg = lastErr
          ? `QuickML batch predict failed: ${lastErr.message || lastErr}`
          : "No QuickML batch predict method found";
        logger.error(failMsg);
        throw new Error(failMsg);
      }
      out.push(...batchPreds);
    }
    return out;
  }

  // Single-call methods removed: require batched predictionRows.
  const msg =
    "predictionRows is required for batched predictions; single-call prediction methods have been removed";
  logger.error(msg);
  throw new Error(msg);
}

module.exports = { predict };
