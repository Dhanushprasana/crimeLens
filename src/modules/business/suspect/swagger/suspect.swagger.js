/**
 * @openapi
 * /suspects:
 *   post:
 *     summary: Add a suspect
 *     tags: [Suspects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - full_name
 *             properties:
 *               suspect_number:
 *                 type: string
 *                 example: SUS-2024-001
 *               full_name:
 *                 type: string
 *                 example: John Doe
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE, OTHER]
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *                 example: "1990-05-20"
 *               nationality:
 *                 type: string
 *                 example: Indian
 *               photo_url:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, CLEARED, ARRESTED]
 *                 default: ACTIVE
 *               address:
 *                 type: string
 *               district_id_of_suspect:
 *                 type: string
 *     responses:
 *       200:
 *         description: Suspect created
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
 * /suspects/getAll:
 *   get:
 *     summary: Get all suspects
 *     tags: [Suspects]
 *     responses:
 *       200:
 *         description: List of suspects
 *
 * /suspects/getOneSuspect/{id}:
 *   get:
 *     summary: Get a suspect by ID
 *     tags: [Suspects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Suspect detail
 *       404:
 *         description: Not found
 *
 * /suspects/{id}:
 *   put:
 *     summary: Update a suspect
 *     tags: [Suspects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Suspect updated
 *   delete:
 *     summary: Delete a suspect
 *     tags: [Suspects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Suspect deleted
 */
