/**
 * @swagger
 * tags:
 *   - name: Forecasting
 *     description: Endpoints for building training data, training, calibration and generating forecasts
 */

/**
 * @swagger
 * /forecast/build-training-data:
 *   post:
 *     tags:
 *       - Forecasting
 *     summary: Build ML training dataset from incidents (fills missing dates)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               train_start:
 *                 type: string
 *                 format: date
 *               train_end:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Training dataset built
 */

/**
 * @swagger
 * /forecast/train:
 *   post:
 *     tags:
 *       - Forecasting
 *     summary: Start training a model with QuickML
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [train_start, train_end, model]
 *             properties:
 *               train_start:
 *                 type: string
 *                 format: date
 *               train_end:
 *                 type: string
 *                 format: date
 *               model:
 *                 type: string
 *                 enum: [SARIMA, AUTO_ARIMA, HOLT_WINTERS]
 *     responses:
 *       200:
 *         description: Training job accepted
 */

/**
 * @swagger
 * /forecast/calibrate:
 *   post:
 *     tags:
 *       - Forecasting
 *     summary: Calibrate model(s) against holdout data
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [model_version, test_start, test_end]
 *             properties:
 *               model_version:
 *                 type: string
 *               train_start:
 *                 type: string
 *                 format: date
 *               train_end:
 *                 type: string
 *                 format: date
 *               test_start:
 *                 type: string
 *                 format: date
 *               test_end:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Calibration report
 */

/**
 * @swagger
 * /forecast/generate:
 *   post:
 *     tags:
 *       - Forecasting
 *     summary: Generate forecasts using the registered model
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *               horizonDays:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Forecasts generated
 */

/**
 * @swagger
 * /forecast:
 *   get:
 *     tags:
 *       - Forecasting
 *     summary: Retrieve recent forecasts
 *     parameters:
 *       - in: query
 *         name: district_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: police_station_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: crime_category_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of forecasts
 */

/**
 * @swagger
 * /forecast/calibration:
 *   get:
 *     tags:
 *       - Forecasting
 *     summary: Get the latest calibration report
 *     responses:
 *       200:
 *         description: Calibration report
 */

/**
 * @swagger
 * /forecast/training/csv:
 *   get:
 *     tags:
 *       - Forecasting
 *     summary: Export the training table as CSV
 *     description: Returns the contents of `biz_district_crime_forecast_training_data` as a CSV file attachment.
 *     parameters:
 *       - in: query
 *         name: train_start
 *         schema:
 *           type: string
 *           format: date
 *         description: Optional start date filter (inclusive)
 *       - in: query
 *         name: train_end
 *         schema:
 *           type: string
 *           format: date
 *         description: Optional end date filter (inclusive)
 *     responses:
 *       200:
 *         description: CSV file attachment
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */

module.exports = {};
