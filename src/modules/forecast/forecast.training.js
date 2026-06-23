"use strict";

const constants = require("./forecast.constants");
const logger = require("../../config/logger");

const MODEL_PIPELINES = {
  AUTO_ARIMA: "crime-auto-arima",
  SARIMA: "crime-sarima",
  HOLT_WINTERS: "crime-holt-winters",
};

async function trainModel(req, options = {}) {
  const payload = options || {};
  const model = (payload.model || "").toUpperCase();
  if (!MODEL_PIPELINES[model]) {
    throw new Error(
      `Unsupported model '${payload.model}'. Supported: ${Object.keys(MODEL_PIPELINES).join(", ")}`,
    );
  }

  const pipelineId = MODEL_PIPELINES[model];
  const trainStart = payload.train_start;
  const trainEnd = payload.train_end;
  if (!trainStart || !trainEnd)
    throw new Error("train_start and train_end are required");

  const zcql = req.catalyst ? req.catalyst.zcql() : null;
  if (!zcql) throw new Error("Catalyst ZCQL not available");

  // Fetch training rows for the given date range
  const cols = [
    "district_id",
    "police_station_id",
    "crime_category_id",
    "crime_registered_date",
    "day_of_week",
    "week_of_year",
    "crime_month",
    "crime_quarter",
    "crime_year",
    "lag_1",
    "lag_7",
    "lag_30",
    "rolling_avg_7",
    "rolling_avg_30",
    "crime_count",
  ];
  const sql = `SELECT ${cols.join(", ")} FROM ${constants.TRAINING_TABLE} WHERE crime_registered_date >= '${trainStart}' AND crime_registered_date <= '${trainEnd}' ORDER BY district_id, police_station_id, crime_category_id, crime_registered_date`;
  const rows = await zcql.executeZCQLQuery(sql);
  if (!rows || !rows.length)
    throw new Error("No training rows found for the given date range");

  // Normalize rows values extraction
  const normalize = (r) => {
    const inner = r[constants.TRAINING_TABLE] || r;
    const out = {};
    for (const c of cols)
      out[c] = inner[c] !== undefined ? inner[c] : inner[c.toUpperCase()] || "";
    return out;
  };

  const data = rows.map(normalize);

  // Build CSV
  function csvEscape(v) {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n"))
      return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
  const header = cols.join(",");
  const csvLines = [header];
  for (const r of data) {
    csvLines.push(cols.map((c) => csvEscape(r[c])).join(","));
  }
  const csv = csvLines.join("\n");

  // Use QuickML client to upload dataset and execute pipeline
  const quickml = req.catalyst
    ? req.catalyst.quickml || req.catalyst.quickML
    : null;
  const client = quickml && typeof quickml === "function" ? quickml() : quickml;
  if (!client) throw new Error("QuickML client not available on req.catalyst");

  let datasetId = null;
  const uploadMethods = [
    "createDataset",
    "uploadDataset",
    "createDataSet",
    "upload",
  ];
  let uploadErr = null;
  for (const m of uploadMethods) {
    if (typeof client[m] === "function") {
      try {
        const res = await client[m]({
          name: `training-${pipelineId}-${Date.now()}`,
          csv,
        });
        datasetId =
          (res &&
            (res.datasetId || res.id || res.dataset_id || res.dataSetId)) ||
          res;
        break;
      } catch (err) {
        uploadErr = err;
        logger.error(`QuickML.${m} failed`, {
          error: err && err.message ? err.message : err,
        });
      }
    }
  }
  if (!datasetId) {
    const msg = uploadErr
      ? `Failed to upload dataset: ${uploadErr.message || uploadErr}`
      : "No QuickML upload method found";
    logger.error(msg);
    throw new Error(msg);
  }

  // Execute pipeline
  const execMethods = [
    "runPipeline",
    "executePipeline",
    "startPipeline",
    "run",
    "execute",
  ];
  let jobId = null;
  let execErr = null;
  for (const m of execMethods) {
    if (typeof client[m] === "function") {
      try {
        const execRes = await client[m]({ pipelineId, datasetId });
        jobId =
          (execRes && (execRes.jobId || execRes.id || execRes.job_id)) ||
          execRes;
        break;
      } catch (err) {
        execErr = err;
        logger.error(`QuickML.${m} failed`, {
          error: err && err.message ? err.message : err,
        });
      }
    }
  }
  if (!jobId) {
    const msg = execErr
      ? `Failed to execute pipeline: ${execErr.message || execErr}`
      : "No QuickML pipeline execution method found";
    logger.error(msg);
    throw new Error(msg);
  }

  // Persist model registry metadata
  const modelVersion = `${model.toLowerCase()}_${Date.now()}`;
  try {
    const table = req.catalyst
      ? req.catalyst.datastore().table(constants.MODEL_REGISTRY_TABLE)
      : null;
    if (table) {
      await table.insertRow({
        model_version: modelVersion,
        model_name: model,
        train_start: trainStart,
        train_end: trainEnd,
        quickml_job_id: jobId,
        quickml_pipeline_id: pipelineId,
        status: "RUNNING",
        created_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    logger.warn("Failed to persist model registry row", {
      error: err && err.message ? err.message : err,
    });
  }

  // Start background poll to update registry when job completes
  (async () => {
    try {
      pollQuickMLJob(req, jobId, pipelineId, modelVersion).catch((e) =>
        logger.error("pollQuickMLJob error", {
          error: e && e.message ? e.message : e,
        }),
      );
    } catch (e) {
      logger.error("Failed to start pollQuickMLJob", {
        error: e && e.message ? e.message : e,
      });
    }
  })();

  return {
    model_version: modelVersion,
    model_name: model,
    train_start: trainStart,
    train_end: trainEnd,
    quickml_job_id: jobId,
    quickml_pipeline_id: pipelineId,
    status: "RUNNING",
  };
}

// Poll QuickML job status in background and update model registry row
async function pollQuickMLJob(req, jobId, pipelineId, modelVersion) {
  const loggerLocal = logger;
  try {
    const quickml = req.catalyst
      ? req.catalyst.quickml || req.catalyst.quickML
      : null;
    const client =
      quickml && typeof quickml === "function" ? quickml() : quickml;
    if (!client) {
      loggerLocal.error("QuickML client not available for polling");
      return;
    }

    const zcql = req.catalyst ? req.catalyst.zcql() : null;
    const getRegistryRowId = async () => {
      try {
        if (!zcql) return null;
        const safeVer = (modelVersion + "").replace(/'/g, "''");
        const rows = await zcql.executeZCQLQuery(
          `SELECT ROWID FROM ${constants.MODEL_REGISTRY_TABLE} WHERE model_version = '${safeVer}' LIMIT 1`,
        );
        if (rows && rows.length) {
          const r = rows[0][constants.MODEL_REGISTRY_TABLE] || rows[0];
          return r.ROWID || r.ROWID || null;
        }
      } catch (err) {
        loggerLocal.warn("Failed to lookup registry row", {
          error: err && err.message ? err.message : err,
        });
      }
      return null;
    };

    const statusMethods = [
      "getJobStatus",
      "getJob",
      "getJobInfo",
      "getStatus",
      "getJobResult",
      "jobStatus",
      "status",
    ];
    const maxAttempts = 60; // ~10 minutes at 10s interval
    const intervalMs = 10000;
    let attempt = 0;
    let finalStatus = null;
    let finalResp = null;

    while (attempt < maxAttempts) {
      attempt++;
      let lastErr = null;
      for (const m of statusMethods) {
        if (typeof client[m] === "function") {
          try {
            const resp = await client[m](jobId || { jobId });
            // resp may be object with status/state or string
            const status =
              (resp &&
                (resp.status ||
                  resp.state ||
                  resp.jobStatus ||
                  resp.result ||
                  resp.stateName)) ||
              null;
            finalResp = resp;
            if (status) {
              const s = String(status).toUpperCase();
              if (
                s.includes("COMPLET") ||
                s.includes("SUCCESS") ||
                s.includes("FINISH")
              ) {
                finalStatus = "COMPLETED";
              } else if (
                s.includes("FAIL") ||
                s.includes("ERROR") ||
                s.includes("CANCEL")
              ) {
                finalStatus = "FAILED";
              } else {
                finalStatus = s;
              }
              break;
            }
          } catch (err) {
            lastErr = err;
            loggerLocal.debug(`QuickML.${m} polling error`, {
              error: err && err.message ? err.message : err,
            });
          }
        }
      }

      if (finalStatus === "COMPLETED" || finalStatus === "FAILED") {
        break;
      }

      // If no method returned status, try generic client.getJob by passing object
      if (!finalStatus && typeof client.getJob === "function") {
        try {
          const resp = await client.getJob({ jobId });
          const status =
            (resp && (resp.status || resp.state || resp.jobStatus)) || null;
          if (status) {
            const s = String(status).toUpperCase();
            if (
              s.includes("COMPLET") ||
              s.includes("SUCCESS") ||
              s.includes("FINISH")
            )
              finalStatus = "COMPLETED";
            else if (
              s.includes("FAIL") ||
              s.includes("ERROR") ||
              s.includes("CANCEL")
            )
              finalStatus = "FAILED";
            else finalStatus = s;
            finalResp = resp;
            break;
          }
        } catch (err) {
          loggerLocal.debug("QuickML.getJob error", {
            error: err && err.message ? err.message : err,
          });
        }
      }

      // sleep
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    // Determine row id and update registry
    const rowId = await getRegistryRowId();
    const table = req.catalyst
      ? req.catalyst.datastore().table(constants.MODEL_REGISTRY_TABLE)
      : null;
    const notes = finalResp ? JSON.stringify(finalResp).slice(0, 2000) : null;
    const statusToWrite = finalStatus || "UNKNOWN";
    if (rowId && table) {
      try {
        await table.updateRow({
          ROWID: rowId,
          status: statusToWrite,
          notes,
          updated_at: new Date().toISOString(),
        });
        loggerLocal.info(
          `Updated model registry ${modelVersion} -> ${statusToWrite}`,
        );
      } catch (err) {
        loggerLocal.warn("Failed to update registry row", {
          error: err && err.message ? err.message : err,
        });
      }
    } else {
      loggerLocal.warn("Could not find registry row to update for model", {
        modelVersion,
      });
    }
  } catch (err) {
    logger.error("pollQuickMLJob failed", {
      error: err && err.message ? err.message : err,
    });
  }
}

module.exports = { trainModel, pollQuickMLJob };
