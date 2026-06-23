/**
 * @openapi
 * /crimes:
 *   post:
 *     summary: Create a crime incident (evidences can be added)
 *     tags: [Crimes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               evidences:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     file_url:
 *                       type: string
 *                     evidence_type:
 *                       type: string
 *     responses:
 *       200:
 *         description: Crime created
 *   get:
 *     summary: Get all crimes
 *     tags: [Crimes]
 *     responses:
 *       200:
 *         description: List of crimes
 *
 * /crimes/getOneCrime/{id}:
 *   get:
 *     summary: Get a crime by id (includes evidences)
 *     tags: [Crimes]
 *   put:
 *     summary: Update crime (can update evidences)
 *     tags: [Crimes]
 *   delete:
 *     summary: Delete crime (developer)
 *     tags: [Crimes]
 */
