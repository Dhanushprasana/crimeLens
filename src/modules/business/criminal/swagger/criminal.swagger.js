/**
 * @openapi
 * /criminals:
 *   post:
 *     summary: Add criminal (developer)
 *     tags: [Criminals]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Criminal added
 *   get:
 *     summary: Get all criminals
 *     tags: [Criminals]
 *     responses:
 *       200:
 *         description: List of criminals
 *
 * /criminals/{id}:
 *   get:
 *     summary: Get one criminal
 *     tags: [Criminals]
 *   put:
 *     summary: Update criminal
 *     tags: [Criminals]
 *   delete:
 *     summary: Delete criminal (developer)
 *     tags: [Criminals]
 */
