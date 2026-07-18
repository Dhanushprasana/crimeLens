"use strict";

const catalyst = require("zcatalyst-sdk-node");

/**
 * Express middleware that initializes the Zoho Catalyst SDK
 * on every incoming request and attaches it to req.catalyst.
 */
module.exports = (req, res, next) => {
  try {
    // Set org ID header if available (needed for QuickML API)
    if (process.env.CATALYST_ORG && !req.headers["zanalytics-orgid"]) {
      req.headers["zanalytics-orgid"] = process.env.CATALYST_ORG;
    }

    req.catalyst = catalyst.initialize(req);
    next();
  } catch (err) {
    next(err);
  }
};
