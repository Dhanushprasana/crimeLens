/**
 * @openapi
 * /geo/districts:
 *   post:
 *     summary: Add district
 *     tags: [Districts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               district_name:
 *                 type: string
 *     responses:
 *       200:
 *         description: District added
 *   get:
 *     summary: Get all districts
 *     tags: [Districts]
 *     responses:
 *       200:
 *         description: List of districts
 *
 * /geo/districts/{id}:
 *   get:
 *     summary: Get district by id
 *     tags: [Districts]
 *   delete:
 *     summary: Delete district
 *     tags: [Districts]
 */
