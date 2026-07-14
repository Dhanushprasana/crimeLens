"use strict";

const logger = require("../../config/logger");
const constants = require("./quickml.constants");

async function predict(catalyst, rows) {
  if (!catalyst) {
    throw new Error("Catalyst instance not available.");
  }

  const quickml = catalyst.quickML();

  logger.info("QuickML Prediction", {
    rows: rows.length
  });

  // Wrap rows in an object (SDK expects object, not array)
  // Org ID is passed via request headers by catalyst middleware
  const inputData = {
    data: rows
  };

  const response = await quickml.predict(
    constants.ENDPOINT_KEY,
    inputData
  );

  return response;
}

module.exports = {
  predict
};
