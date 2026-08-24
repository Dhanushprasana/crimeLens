"use strict";

const catalyst = require("zcatalyst-sdk-node");
const logger = require("../config/logger");



/**
 * Express middleware that initializes the Zoho Catalyst SDK
 * on every incoming request and attaches it to req.catalyst.
 * Falls back to a safe local stub when running outside AppSail/local Catalyst runtime.
 */
module.exports = (req, res, next) => {
  try {
    // Set org ID header if available (needed for QuickML API)
    if (process.env.CATALYST_ORG && !req.headers["zanalytics-orgid"]) {
      req.headers["zanalytics-orgid"] = process.env.CATALYST_ORG;
    }

    try {
      req.catalyst = catalyst.initialize(req);
      logger.info("Catalyst SDK initialized successfully");
    } catch (err) {
      logger.warn("Catalyst SDK initialization failed, using local stub", {
        error: err && err.message ? err.message : err,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};
