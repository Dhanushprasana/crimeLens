"use strict";

const express = require("express");
const router = express.Router();
const logger = require("../../config/logger");
const sdkVerification = require("../../catalyst/sdk-verification");

/**
 * DEBUG ONLY: Verify Catalyst SDK capabilities for QuickML integration
 *
 * This route outputs detailed information about what methods are available
 * on the Catalyst SDK instance. Use this to verify that your SDK version
 * supports the required access token API before deploying to production.
 *
 * Usage:
 *   GET /debug/verify-sdk
 *
 * Response:
 *   - Logs detailed SDK capability info to console
 *   - Returns 200 with summary of available APIs
 */
router.get("/verify-sdk", (req, res, next) => {
  try {
    logger.info("[DEBUG] Starting SDK verification");

    // Run verification (outputs to console)
    sdkVerification.verify(req.catalyst);

    // Also send detailed response
    const result = {
      status: "SDK verification started",
      checkConsole: "Check application logs/console for detailed output",
      catalystAvailable: !!req.catalyst,
      keysOnCatalyst: req.catalyst ? Object.keys(req.catalyst) : [],
      methods: {
        hasConnection: typeof req.catalyst?.connection === "function",
        hasCredential: typeof req.catalyst?.credential === "function",
        hasQuickml: typeof req.catalyst?.quickml === "function",
        hasQuickML: typeof req.catalyst?.quickML === "function",
      },
      nextSteps:
        "Review console output to determine which token API is available. " +
        "If connection().getConnector('quickml').getAccessToken() or credential().getAccessToken() " +
        "is available, the Catalyst SDK integration is ready to use.",
    };

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * DEBUG ONLY: Test QuickML access token retrieval
 *
 * This route attempts to obtain a QuickML access token using the quickml.client
 *
 * Usage:
 *   GET /debug/test-token
 *
 * Response:
 *   - 200 with token info if successful
 *   - 500 with error details if token retrieval fails
 */
router.get("/test-token", async (req, res, next) => {
  try {
    const quickml = require("../../catalyst/quickml.client");

    logger.info("[DEBUG] Attempting to retrieve QuickML access token");

    const token = await quickml.getAccessToken(req.catalyst);

    const response = {
      status: "success",
      message: "Successfully obtained QuickML access token from Catalyst SDK",
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? token.substring(0, 20) + "..." : "N/A",
      timestamp: new Date().toISOString(),
    };

    logger.info("[DEBUG] Token retrieval successful", response);
    res.json(response);
  } catch (err) {
    logger.error("[DEBUG] Token retrieval failed", {
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve QuickML access token",
      error: err.message,
      troubleshooting:
        "1. Verify zcatalyst-sdk-node@3.4.0 is installed\n" +
        "2. Run GET /debug/verify-sdk to check available SDK methods\n" +
        "3. Check Catalyst SDK documentation for your version\n" +
        "4. Review application logs for detailed error information",
    });
  }
});

/**
 * DEBUG ONLY: Inspect Catalyst QuickML service capabilities
 *
 * This route inspects the native quickML service on the Catalyst SDK
 * to determine what methods are available for predictions.
 *
 * Usage:
 *   GET /debug/quickml
 *
 * Response:
 *   - Lists all methods available on quickML() service
 *   - Shows if predict() method exists
 */
router.get("/quickml", async (req, res, next) => {
  try {
    logger.info("[DEBUG] Inspecting req.catalyst.quickML()");

    if (!req.catalyst || typeof req.catalyst.quickML !== "function") {
      return res.status(400).json({
        status: "error",
        message: "quickML is not available on req.catalyst",
        hasQuickML: typeof req.catalyst?.quickML === "function",
      });
    }

    const quickml = req.catalyst.quickML();

    const result = {
      status: "success",
      quickMLAvailable: !!quickml,
      methods: Object.keys(quickml),
      prototypeChain: Object.getOwnPropertyNames(
        Object.getPrototypeOf(quickml),
      ),
      hasPredict: typeof quickml.predict === "function",
      hasDeployments: typeof quickml.deployments === "function",
      hasModels: typeof quickml.models === "function",
      timestamp: new Date().toISOString(),
    };

    logger.info("[DEBUG] QuickML inspection result", result);
    res.json(result);
  } catch (err) {
    logger.error("[DEBUG] QuickML inspection failed", {
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      status: "error",
      message: "Failed to inspect quickML service",
      error: err.message,
    });
  }
});

/**
 * DEBUG ONLY: Inspect the signature of quickML.predict() method
 *
 * This route extracts the source code and metadata of the predict method
 * to determine its exact signature and how it should be called.
 *
 * Usage:
 *   GET /debug/predict-signature
 *
 * Output:
 *   - Logs full method source to console
 *   - Returns signature metadata
 */
router.get("/predict-signature", async (req, res, next) => {
  try {
    const quickml = req.catalyst.quickML();
    const predictMethod = quickml.predict;

    // Log to console for full visibility
    logger.info("[DEBUG] ========== PREDICT METHOD SOURCE ==========");
    logger.info(predictMethod.toString());
    logger.info("[DEBUG] ==========================================");

    // Also return metadata
    const result = {
      status: "success",
      predictExists: typeof predictMethod === "function",
      type: typeof predictMethod,
      parameterCount: predictMethod.length,
      methodSource: predictMethod.toString(),
      checkConsole: "Full method source logged to console above",
    };

    res.json(result);
  } catch (err) {
    logger.error("[DEBUG] Failed to inspect predict method", {
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      status: "error",
      message: "Failed to inspect predict method signature",
      error: err.message,
    });
  }
});

module.exports = router;
