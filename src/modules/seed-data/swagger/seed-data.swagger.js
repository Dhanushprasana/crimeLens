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
 *       Inserts crime incident records from a JSON file located in
 *       `src/modules/seed-data/data/crimie/`. If `fileName` is provided in the request body,
 *       the service will use that file (basename only). Split files such as `crime_incident-1.json`
 *       through `crime_incident-10.json` are supported, and `crime_incident.json` is used by default.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: Filename under `src/modules/seed-data/data/crimie/` to import (basename only), for example `crime_incident-1.json`
 *     responses:
 *       200:
 *         description: Crime incidents bootstrap completed and returns inserted/skipped counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 created:
 *                   type: integer
 *                 skipped:
 *                   type: integer
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
 * /seed/legal/bootstrap:
 *   post:
 *     summary: Bootstrap legal data (acts, chapters, sections)
 *     tags: [Seed Data]
 *     description: Reads `data/legal/legal_acts.csv`, `legal_chapters.csv`, and `legal_sections.csv` and populates the respective database tables.
 *     responses:
 *       200:
 *         description: Counts of inserted acts, chapters, and sections
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
 * /seed/suspect/bootstrap:
 *   post:
 *     summary: Bootstrap suspects
 *     tags: [Seed Data]
 *     description: Reads suspect seed data and inserts suspect records into the datastore.
 *     responses:
 *       200:
 *         description: Suspects inserted/skipped counts
 */

/**
 * @openapi
 * /seed/fir/bootstrap:
 *   post:
 *     summary: Bootstrap FIRs
 *     tags: [Seed Data]
 *     description: Reads a FIR seed file from `data/crimie/` and inserts the rows into `biz_FIR`. You can pass `fileName` as `FIRs-1.json` through `FIRs-10.json`; otherwise `FIRs.json` is used by default.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: File name under `src/modules/seed-data/data/crimie/`, for example `FIRs-3.json`
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
 *     description: Reads a relationship seed file from `data/crimie/` and inserts links between crime incidents and criminals into `biz_incident_criminal`. You can pass `fileName` as `incident_criminal-1.json` through `incident_criminal-10.json`; otherwise `incident_criminal.json` is used by default.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: File name under `src/modules/seed-data/data/crimie/`, for example `incident_criminal-3.json`
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
 * /seed/crime-evidence/bootstrap:
 *   post:
 *     summary: Bootstrap crime evidence files
 *     tags: [Seed Data]
 *     description: Fetches media from Catalyst file storage and assigns them to crime incidents in `biz_crime_evidence`.
 *     responses:
 *       200:
 *         description: Evidence links inserted/skipped counts
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /seed/incident-officer/bootstrap:
 *   post:
 *     summary: Bootstrap incident officers
 *     tags: [Seed Data]
 *     description: Reads an incident officer seed file from `data/incident-officer/` and assigns officers to incidents. You can pass `fileName` as `incident_officer-1.json` through `incident_officer-10.json`; otherwise `incident_officer.json` is used by default.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: File name under `src/modules/seed-data/data/incident-officer/`, for example `incident_officer-5.json`
 *     responses:
 *       200:
 *         description: Incident officers inserted/skipped counts
 */

/**
 * @openapi
 * /seed/victim/bootstrap:
 *   post:
 *     summary: Bootstrap victims
 *     tags: [Seed Data]
 *     description: Reads a victim seed file from `data/victim/` and inserts victims into the datastore. You can pass `fileName` as `victim-1.json` through `victim-10.json`; otherwise `victim.json` is used by default.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: File name under `src/modules/seed-data/data/victim/`, for example `victim-2.json`
 *     responses:
 *       200:
 *         description: Victims inserted/skipped counts
 */

/**
 * @openapi
 * /seed/witness/bootstrap:
 *   post:
 *     summary: Bootstrap witnesses
 *     tags: [Seed Data]
 *     description: Reads a witness seed file from `data/witness/` and inserts witnesses into the datastore. You can pass `fileName` as `witness-1.json` through `witness-10.json`; otherwise `witness.json` is used by default.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: File name under `src/modules/seed-data/data/witness/`, for example `witness-4.json`
 *     responses:
 *       200:
 *         description: Witnesses inserted/skipped counts
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
