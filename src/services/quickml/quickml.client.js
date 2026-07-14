"use strict";

const logger = require("../../config/logger");
const constants = require("./quickml.constants");

async function predict(catalyst, rows) {
  if (!catalyst) {
    throw new Error("Catalyst instance not available.");
  }

  logger.info("quickml.predict called", {
    endpointKey: constants.ENDPOINT_KEY
      ? constants.ENDPOINT_KEY.substring(0, 10) + "..."
      : "NOT SET",
    rowCount: rows.length,
  });

  const quickml = catalyst.quickML();
  logger.info("quickml client obtained", {
    hasPredict: typeof quickml.predict === "function",
  });

  logger.info("QuickML Prediction", {
    rows: rows.length,
  });

  // Wrap rows in an object (SDK expects object, not array)
  // Org ID is passed via request headers by catalyst middleware
  const inputData = {
    data: rows,
  };

  logger.info("Calling quickml.predict with input", {
    inputDataKeys: Object.keys(inputData),
    dataLength: inputData.data.length,
  });

  try {
    const response = await quickml.predict(constants.ENDPOINT_KEY, inputData);
    logger.info("quickml.predict completed", {
      responseType: typeof response,
      responseLength: Array.isArray(response) ? response.length : "not-array",
    });
    return response;
  } catch (err) {
    logger.error("quickml.predict failed", {
      message: err.message,
      code: err.code,
      stack: err.stack,
      errorObj: JSON.stringify(err),
    });
    throw err;
  }
}

module.exports = {
  predict,
};
