/**
 * @swagger
 * tags:
 *   - name: Forecasting
 *     description: Endpoints for building training data, training, calibration and generating forecasts
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
 * /forecast/anomaly-detection:
 *   post:
 *     tags:
 *       - Forecasting
 *     summary: Compare forecasts vs actuals to detect anomalies
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               start_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *               district_id:
 *                 type: string
 *               police_station_id:
 *                 type: string
 *               crime_category_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Anomalies detected and recorded
 */

module.exports = {};
