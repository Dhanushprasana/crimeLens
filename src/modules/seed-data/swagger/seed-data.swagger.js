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
 * Note: These endpoints are intended for development/bootstrapping only.
 */
