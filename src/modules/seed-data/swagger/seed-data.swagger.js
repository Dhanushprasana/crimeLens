/**
 * @swagger
 * tags:
 *   - name: SeedData
 *     description: Endpoints for seeding application data from sample files
 */

/**
 * @swagger
 * /seed/crime-incident/bootstrap:
 *   post:
 *     tags:
 *       - SeedData
 *     summary: Bootstrap crime incidents from a data file (optional fileName)
 *     description: |
 *       Starts a background job to insert crime incident records from a JSON file located in
 *       `src/modules/seed-data/data/crimie/`. If `fileName` is provided in the request body,
 *       the service will use that file (basename only). Returns 202 with a `jobId` and `statusUrl`.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: Filename under `src/modules/seed-data/data/crimie/` to import (basename only)
 *     responses:
 *       202:
 *         description: Job accepted and running in background; returns jobId and statusUrl
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                 statusUrl:
 *                   type: string
 */

module.exports = {};
/**
 * @openapi
 * /seed/geojson/bootstrap:
 *   post:
 *     summary: Bootstrap district geojson into datastore
 *     tags: [Seed Data]
 *     description: Reads local geojson files and inserts district geodata rows into the datastore.
 *     responses:
 *       200:
 *         description: District geojson bootstrap executed
 */

/**
 * @openapi
 * /seed/police-rank/bootstrap:
 *   post:
 *     summary: Bootstrap police ranks
 *     tags: [Seed Data]
 *     description: Reads `data/police-officer/police_rank.json` and inserts missing ranks.
 *     responses:
 *       200:
 *         description: Police ranks inserted/skipped counts
 */

/**
 * @openapi
 * /seed/police-station/bootstrap:
 *   post:
 *     summary: Bootstrap police stations from geojson
 *     tags: [Seed Data]
 *     description: Reads `data/police-station/police_stations.geojson` and inserts stations. Attempts to resolve district by name.
 *     responses:
 *       200:
 *         description: Police stations inserted/skipped counts
 */

/**
 * @openapi
 * /seed/crime-category/bootstrap:
 *   post:
 *     summary: Bootstrap crime categories
 *     tags: [Seed Data]
 *     description: Reads `data/crimie/crime_category.json` and inserts missing crime categories into `biz_crime_category`.
 *     responses:
 *       200:
 *         description: Crime categories inserted/skipped counts
 */

/**
 * @openapi
 * /seed/police-officer/bootstrap:
 *   post:
 *     summary: Bootstrap police officers
 *     tags: [Seed Data]
 *     description: Reads `data/police-officer/police_officer.json` and creates officers. For entries with email, creates Catalyst auth users with default password `police@123` and links to `sys_user`.
 *     responses:
 *       200:
 *         description: Officers inserted/skipped and auth created counts
 */

/**
 * @openapi
 * /seed/criminal/bootstrap:
 *   post:
 *     summary: Bootstrap criminals
 *     tags: [Seed Data]
 *     description: Reads `data/criminal/criminal.json`, resolves district codes to ROWIDs and inserts into `biz_criminal`.
 *     responses:
 *       200:
 *         description: Criminals inserted/skipped counts
 */

/**
 * @openapi
 * /seed/fir/bootstrap:
 *   post:
 *     summary: Bootstrap FIRs
 *     tags: [Seed Data]
 *     description: Reads `data/crimie/FIRs.json`, resolves district and station references and inserts into `biz_FIR`.
 *     responses:
 *       200:
 *         description: FIRs inserted/skipped counts
 */

/**
 * @openapi
 * /seed/crime-incident/generate:
 *   post:
 *     summary: Generate a crime incident using valid reference data
 *     tags: [Seed Data]
 *     description: |
 *       Creates a single crime incident. The request body may contain any of the
 *       fields shown in the example below; missing fields are filled with valid
 *       values resolved from the database (category, police station, district, etc.).
 *
 *     responses:
 *       200:
 *         description: Generated crime incident inserted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CrimeIncident'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /seed/incident-criminal/bootstrap:
 *   post:
 *     summary: Bootstrap incident‑criminal relationships
 *     tags: [Seed Data]
 *     description: Reads `data/crimie/incident_criminal.json` and inserts links between crime incidents and criminals into `biz_incident_criminal`.
 *     responses:
 *       200:
 *         description: Incident‑criminal links inserted/skipped counts
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /seed/district-crime-stats/calculate:
 *   post:
 *     summary: Calculate and upsert district crime statistics
 *     tags: [Seed Data]
 *     description: Aggregates crime incidents by district, station, category, and registration date, and upserts the statistics into `biz_comp_district_crime_stats`.
 *     responses:
 *       200:
 *         description: Statistics calculated and populated successfully
 *       500:
 *         description: Server error
 */

/**
 * Note: These endpoints are intended for development/bootstrapping only.
 */

/**
 * @openapi
 * /seed/record-counts:
 *   get:
 *     summary: Get record counts for all tables
 *     tags: [Seed Data]
 *     description: Iterates through all database tables and returns the count of records for each.
 *     responses:
 *       200:
 *         description: Record counts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 *       500:
 *         description: Server error
 */
