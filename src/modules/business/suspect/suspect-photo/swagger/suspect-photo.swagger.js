/**
 * @openapi
 * /suspect-photos:
 *   post:
 *     summary: Add a photo to a suspect
 *     tags: [Suspect Photos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - suspect_id
 *               - photo_url
 *             properties:
 *               suspect_id:
 *                 type: string
 *                 example: "46044000000123456"
 *               photo_url:
 *                 type: string
 *                 example: "https://storage.example.com/suspects/photo1.jpg"
 *     responses:
 *       200:
 *         description: Photo added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *
 * /suspect-photos/bySuspect/{suspectId}:
 *   get:
 *     summary: Get all photos for a suspect
 *     tags: [Suspect Photos]
 *     parameters:
 *       - in: path
 *         name: suspectId
 *         required: true
 *         schema:
 *           type: string
 *         example: "46044000000123456"
 *     responses:
 *       200:
 *         description: List of suspect photos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       ROWID:
 *                         type: string
 *                       photo_url:
 *                         type: string
 *                       suspect_id:
 *                         type: string
 *
 * /suspect-photos/{id}:
 *   delete:
 *     summary: Delete a suspect photo by ID
 *     tags: [Suspect Photos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Photo deleted
 */
