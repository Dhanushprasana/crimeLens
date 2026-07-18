"use strict";

const logger = require("../config/logger");

const config = {
  ENDPOINT: process.env.QUICKML_ENDPOINT,
  ENDPOINT_KEY: process.env.QUICKML_ENDPOINT_KEY,
  ORG_ID: process.env.CATALYST_ORG,
};

/**
 * Get access token from Catalyst SDK
 * Tries multiple possible SDK APIs (v3.4.0 may vary)
 */
async function getAccessToken(catalystApp) {
  if (!catalystApp) {
    throw new Error("Catalyst app instance not provided");
  }

  let token = null;
  let tokenMethod = null;

  // Try connection().getConnector('quickml').getAccessToken()
  try {
    if (typeof catalystApp.connection === "function") {
      const conn = catalystApp.connection();
      if (typeof conn.getConnector === "function") {
        const quickmlConnector = conn.getConnector("quickml");
        if (typeof quickmlConnector.getAccessToken === "function") {
          token = await quickmlConnector.getAccessToken();
          tokenMethod = 'connection().getConnector("quickml").getAccessToken()';
          logger.info(
            "QuickML token obtained via connection().getConnector()",
            { tokenMethod },
          );
          return token;
        }
      }
    }
  } catch (err) {
    logger.debug("connection().getConnector() method not available or failed", {
      error: err.message,
    });
  }

  // Try credential().getAccessToken()
  try {
    if (typeof catalystApp.credential === "function") {
      const cred = catalystApp.credential();
      if (typeof cred.getAccessToken === "function") {
        token = await cred.getAccessToken();
        tokenMethod = "credential().getAccessToken()";
        logger.info("QuickML token obtained via credential()", { tokenMethod });
        return token;
      }
    }
  } catch (err) {
    logger.debug("credential() method not available or failed", {
      error: err.message,
    });
  }

  // If we get here, no token method worked
  throw new Error(
    "Unable to obtain QuickML access token from Catalyst SDK. " +
      "Ensure zcatalyst-sdk-node@3.4.0 exposes getAccessToken API.",
  );
}

/**
 * Call QuickML API with predictions
 * Handles batch processing and error management
 */
async function callQuickMLAPI(token, predictionRows) {
  if (!config.ENDPOINT) {
    throw new Error("QUICKML_ENDPOINT not configured");
  }

  if (!config.ENDPOINT_KEY) {
    throw new Error("QUICKML_ENDPOINT_KEY not configured");
  }

  const payload = {
    rows: predictionRows,
  };

  logger.debug("Calling QuickML endpoint", {
    endpoint: config.ENDPOINT,
    rowCount: predictionRows.length,
  });

  try {
    const response = await fetch(config.ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CATALYST-ORG": config.ORG_ID || "",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("QuickML API error response", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`QuickML API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    logger.debug("QuickML response received", {
      predictions: Array.isArray(result.predictions)
        ? result.predictions.length
        : "N/A",
    });

    return result.predictions || result;
  } catch (err) {
    logger.error("QuickML API call failed", {
      error: err.message,
      endpoint: config.ENDPOINT,
    });
    throw err;
  }
}

/**
 * Predict using QuickML
 * - Obtains fresh access token from Catalyst SDK
 * - Calls QuickML API
 * - Handles token refresh automatically by SDK
 *
 * @param {Object} catalystApp - req.catalyst instance
 * @param {Array} predictionRows - Array of prediction input rows
 * @returns {Promise<Array>} Array of predictions
 */
async function predict(catalystApp, predictionRows) {
  if (!Array.isArray(predictionRows) || predictionRows.length === 0) {
    throw new Error("predictionRows must be a non-empty array");
  }

  logger.info("QuickML predict started", {
    rowCount: predictionRows.length,
  });

  try {
    // Step 1: Get access token (SDK handles refresh automatically)
    const token = await getAccessToken(catalystApp);

    // Step 2: Call QuickML API
    const predictions = await callQuickMLAPI(token, predictionRows);

    logger.info("QuickML predictions completed", {
      rowCount: predictionRows.length,
      predictionsReceived: Array.isArray(predictions) ? predictions.length : 1,
    });

    return predictions;
  } catch (err) {
    logger.error("QuickML predict failed", {
      error: err.message,
      rowCount: predictionRows.length,
    });
    throw err;
  }
}

module.exports = {
  predict,
  getAccessToken,
  callQuickMLAPI,
};
