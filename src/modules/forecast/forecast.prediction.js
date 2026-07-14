"use strict";

const quickml = require("../../services/quickml/quickml.client");

async function predict(req, { predictionRows }) {
  return quickml.predict(
    req.catalyst,
    predictionRows
  );
}

module.exports = {
  predict
};
