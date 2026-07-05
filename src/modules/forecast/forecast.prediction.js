"use strict";

const constants = require("./forecast.constants");
const logger = require("../../config/logger");

async function predict(
  req,
  {
    model_version,
    startDate,
    horizonDays = 30,
    contextRows = [],
    predictionRows = [],
    batchSize = 5000,
  } = {},
) {
  // Try to use Catalyst QuickML if available on req.catalyst
  // Use QuickML client and surface errors (no graceful fallback)
  const client = req.catalyst && typeof req.catalyst.quickML === "function" 
    ? req.catalyst.quickML() 
    : (req.catalyst && req.catalyst.quickml ? req.catalyst.quickml() : null);
  if (!client) {
    const msg = "QuickML client not available on req.catalyst";
    logger.error(msg);
    throw new Error(msg);
  }

  console.log("=== QUICKML DEBUG INFO ===");
  console.log("req.catalyst keys:", req.catalyst ? Object.keys(req.catalyst) : "undefined");
  console.log("client:", client);
  console.log("client keys:", Object.keys(client));
  console.log("typeof client.predict:", typeof client.predict);
  console.log("client.projectId:", client.projectId);
  console.log("==========================");

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
      let lastErr = null;
      
      const tryPayloads = [
        { rows: batch },
        { data: batch },
        { input_data: batch }
      ];
      
      for (const payload of tryPayloads) {
        try {
          const r = await client.predict(model_version, payload);
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
          if (r && Array.isArray(r.data)) {
            batchPreds = r.data;
            break;
          }
          // If we got a successful response but unknown format, assume it was successful
          if (r) {
            batchPreds = r;
            break;
          }
        } catch (err) {
          logger.error(`QuickML predict failed for payload`, { payloadShape: Object.keys(payload), error: err.message || err });
          lastErr = err;
        }
      }
      
      if (!batchPreds) {
        const failMsg = lastErr
          ? `QuickML batch predict failed: ${lastErr.message || lastErr}`
          : "QuickML batch predict failed on all payload shapes";
        logger.error(failMsg);
        throw new Error(failMsg);
      }
      
      // Flatten predictions if they were wrapped
      if (Array.isArray(batchPreds)) {
        out.push(...batchPreds);
      } else {
        out.push(batchPreds);
      }
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
