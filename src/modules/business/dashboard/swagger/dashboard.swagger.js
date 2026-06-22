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
