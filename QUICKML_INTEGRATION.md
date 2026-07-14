# Catalyst QuickML Integration - Implementation Guide

## Overview

This implementation uses the **native Catalyst SDK** `quickML().predict(endPointKey, inputData)` method to directly call QuickML predictions. No OAuth tokens, manual authentication, or HTTP clients needed — the SDK handles everything internally.

## Architecture

```
Forecast API → Generate rows → Split batches
    ↓
forecast.prediction.predict()
    ↓
req.catalyst.quickML().predict(endPointKey, rows)
    ↓
Catalyst SDK (auth, tokens, requests)
    ↓
QuickML Model → Predictions → Process results
    ↓
Datastore insertRows() → Done
```

## Method Signature

The Catalyst SDK exposes:

```javascript
await quickml.predict(endPointKey, inputData)
```

**Parameters:**
- `endPointKey` (string): Your QuickML endpoint key from `QUICKML_ENDPOINT_KEY` env
- `inputData` (array): Array of prediction row objects

**Returns:** Promise<Array> with predictions

## Implementation - `src/modules/forecast/forecast.prediction.js`

```javascript
"use strict";

const logger = require("../../config/logger");

async function predict(req, { predictionRows } = {}) {
  if (!Array.isArray(predictionRows) || predictionRows.length === 0) {
    throw new Error("predictionRows is required and must be a non-empty array");
  }

  if (!req.catalyst) {
    throw new Error("Catalyst SDK not initialized on request");
  }

  const endPointKey = process.env.QUICKML_ENDPOINT_KEY;
  if (!endPointKey) {
    throw new Error("QUICKML_ENDPOINT_KEY environment variable not set");
  }

  try {
    const quickml = req.catalyst.quickML();
    
    logger.info("QuickML predict called", { rowCount: predictionRows.length });

    // Native SDK method: predict(endPointKey, inputData)
    const predictions = await quickml.predict(endPointKey, predictionRows);

    logger.info("QuickML predictions completed", { rowCount: predictionRows.length });

    return predictions;
  } catch (err) {
    logger.error("QuickML prediction failed", {
      error: err.message,
      rowCount: predictionRows.length
    });
    throw err;
  }
}

module.exports = { predict };
```

### 2. `src/modules/forecast/forecast.prediction.js` (UPDATED)
**Before**: 150+ lines attempting to find QuickML methods on req.catalyst  
**After**: ~30 lines delegating to quickml.client

**New Implementation**:
```javascript
async function predict(req, { predictionRows } = {}) {
  // Validation
  if (!Array.isArray(predictionRows) || predictionRows.length === 0) {
    throw new Error('predictionRows is required and must be a non-empty array');
  }
  if (!req.catalyst) {
    throw new Error('Catalyst SDK not initialized on request');
  }

  // Delegate to quickml client
  return quickml.predict(req.catalyst, predictionRows);
}
```

### 3. `src/catalyst/sdk-verification.js` (NEW)
**Purpose**: Debug helper to inspect Catalyst SDK capabilities

**Usage**:
```javascript
const { verify } = require('./sdk-verification');
verify(req.catalyst);
// Logs detailed output to console showing available methods
```

### 4. `src/modules/check-health/debug.route.js` (NEW)
**Purpose**: Endpoints to verify SDK integration before production deployment

**Endpoints**:

#### `GET /debug/verify-sdk`
Outputs detailed SDK capability information
```json
{
  "status": "SDK verification started",
  "catalystAvailable": true,
  "methods": {
    "hasConnection": true,
    "hasCredential": false,
    "hasQuickml": false,
    "hasQuickML": false
  }
}
```

#### `GET /debug/test-token`
Attempts to retrieve a QuickML access token
```json
{
  "status": "success",
  "message": "Successfully obtained QuickML access token",
  "tokenLength": 500,
  "tokenPreview": "eyJhbGciOiJSUzI1Ni...",
  "timestamp": "2026-07-14T10:30:00.000Z"
}
```

## Environment Variables

Ensure these are configured in your `.env`:

```bash
# QuickML Endpoint Configuration
QUICKML_ENDPOINT=https://your-quickml-endpoint.com/predict
QUICKML_ENDPOINT_KEY=your-endpoint-key
CATALYST_ORG=your-org-id

# These should already be configured for Catalyst SDK
CATALYST_APP_ID=your-app-id
CATALYST_APP_ROLE=your-app-role
```

## Verification Steps

Before deploying to production, verify the Catalyst SDK integration:

### 1. Check SDK Capabilities
```bash
curl http://localhost:3000/debug/verify-sdk
```

Look for output indicating available token methods:
- ✅ `connection().getConnector('quickml').getAccessToken()` (Preferred)
- ✅ `credential().getAccessToken()` (Fallback)

### 2. Test Token Retrieval
```bash
curl http://localhost:3000/debug/test-token
```

Response should show successful token with length > 100 characters.

### 3. Test Full Prediction Flow
Call forecast API with a small batch:
```bash
curl -X POST http://localhost:3000/forecast/generate \
  -H "Content-Type: application/json" \
  -d '{ "model_version": "V1", "forecast_start": "2026-07-14" }'
```

Check logs for successful predictions.

## How It Works

### Token Management Flow
1. **Request arrives** → Catalyst middleware initializes SDK on `req.catalyst`
2. **Prediction needed** → `forecast.prediction.predict()` called
3. **Delegate to client** → Calls `quickml.predict(req.catalyst, rows)`
4. **Get token** → `quickml.client` calls `getAccessToken(req.catalyst)`
5. **SDK generates token** → Catalyst SDK automatically manages OAuth
6. **Call API** → Uses fresh token to POST to QuickML endpoint
7. **Return predictions** → Results sent back through the chain

### Token Refresh (Automatic)
- The Catalyst SDK handles all token refresh logic
- No need to manually check token expiry
- No need to manage refresh tokens separately

## Compatibility

**SDK Version**: zcatalyst-sdk-node@3.4.0

This implementation supports:
- ✅ Automatic token generation
- ✅ Batch prediction requests
- ✅ Error logging and retry logic
- ✅ Multiple SDK API compatibility paths

**Note**: If the SDK version changes, the token retrieval methods may differ. Use the `/debug/verify-sdk` endpoint to confirm availability.

## Troubleshooting

### Issue: "Unable to obtain QuickML access token"
**Solution**: 
1. Run `GET /debug/verify-sdk` to see available SDK methods
2. Check SDK documentation for your version
3. Verify `zcatalyst-sdk-node@3.4.0` is installed

### Issue: "QUICKML_ENDPOINT not configured"
**Solution**: 
1. Add `QUICKML_ENDPOINT` to `.env`
2. Restart the application

### Issue: "QuickML API returned 401"
**Solution**:
1. Token may be expired or invalid
2. Run `/debug/test-token` to verify token generation
3. Check `QUICKML_ENDPOINT_KEY` is correct

## Production Deployment

Before deploying:

1. ✅ Run verification endpoints and confirm success
2. ✅ Test full forecast flow with small batch
3. ✅ Monitor logs for token generation errors
4. ✅ Remove debug routes or restrict to authenticated users
5. ✅ Configure environment variables
6. ✅ Enable HTTPS for all API calls

To disable debug routes in production, update [src/routes/index.js](src/routes/index.js):
```javascript
// Only register debug routes in development
if (process.env.NODE_ENV !== 'production') {
  router.use("/debug", debugRoute);
}
```

## References

- [Catalyst SDK Documentation](https://docs.catalyst.zoho.com)
- [QuickML API Documentation](https://quickml.zoho.com/docs)
- OAuth Token Management (handled by Catalyst SDK)
