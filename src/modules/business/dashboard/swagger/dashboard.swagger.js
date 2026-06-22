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
