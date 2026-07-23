/**
 * @openapi
 * /dashboard/district-crime-stats:
 *   get:
 *     summary: Get district crime statistics
 *     tags: [Dashboard]
 *     description: Retrieve all aggregated crime statistics from the `biz_comp_district_crime_stats` table.
 *     responses:
 *       200:
 *         description: Array of district crime stats
 *       500:
 *         description: Server error
 *
 * /dashboard/crimes/count:
 *   get:
 *     summary: Get filtered crime count
 *     tags: [Dashboard]
 *     description: Retrieves the count of crimes with optional filters like date range, station, district, category, and gender.
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Specific date (YYYY-MM-DD)
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: string
 *         description: Police Station ID
 *       - in: query
 *         name: districtId
 *         schema:
 *           type: string
 *         description: District ID
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Crime Category ID
 *       - in: query
 *         name: gender
 *         schema:
 *           type: string
 *         description: Victim Gender (e.g., MALE, FEMALE)
 *     responses:
 *       200:
 *         description: Filtered crime count
 *
 * /dashboard/crimes/count-with-previous-year:
 *   get:
 *     summary: Get crime count and previous year count
 *     tags: [Dashboard]
 *     description: Retrieves crime count for the specified period and the exact same period one year prior. Accepts the same filters as /dashboard/crimes/count.
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: string
 *       - in: query
 *         name: districtId
 *         schema:
 *           type: string
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: gender
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Current and previous year crime counts
 *
 * /dashboard/crimes/growth:
 *   get:
 *     summary: Get crime growth
 *     tags: [Dashboard]
 *     description: Calculates the growth percentage by comparing the current date range with the immediately preceding date range of the same length. Requires fromDate and toDate.
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: toDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: string
 *       - in: query
 *         name: districtId
 *         schema:
 *           type: string
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: gender
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Crime growth statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 current_period_count:
 *                   type: integer
 *                 previous_period_count:
 *                   type: integer
 *                 difference:
 *                   type: integer
 *                 growth_percentage:
 *                   type: number
 */

/**
 * @openapi
 * /dashboard/total-crime-count:
 *   get:
 *     summary: Get total crime count
 *     tags: [Dashboard]
 *     description: Retrieves the sum of the `crime_count` field from the `biz_comp_district_crime_stats` table.
 *     responses:
 *       200:
 *         description: Total crime count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_crime_count:
 *                   type: integer
 *                   description: Sum of all crime counts
 *       500:
 *         description: Server error
 */
