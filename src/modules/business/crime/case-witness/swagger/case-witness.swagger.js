/**
 * @openapi
 * /case-witnesses:
 *   post:
 *     summary: Add a witness to a crime incident
 *     tags: [Case Witnesses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - incident_id
 *               - full_name
 *             properties:
 *               incident_id:
 *                 type: string
 *                 example: "46044000000111111"
 *               full_name:
 *                 type: string
 *                 example: Ravi Kumar
 *               gender:
 *                 type: string
 *                 example: MALE
 *               age:
 *                 type: integer
 *                 example: 34
 *               mobile_number:
 *                 type: string
 *                 example: "9876543210"
 *               email:
 *                 type: string
 *                 example: ravi@example.com
 *               address:
 *                 type: string
 *                 example: 12 Main Street, Chennai
 *               occupation:
 *                 type: string
 *                 example: Teacher
 *               witness_type:
 *                 type: string
 *                 example: EYE_WITNESS
 *               statement:
 *                 type: string
 *                 example: "I saw the suspect run towards the north exit."
 *     responses:
 *       200:
 *         description: Witness added
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
 * /case-witnesses/byIncident/{incidentId}:
 *   get:
 *     summary: Get all witnesses for a specific incident
 *     tags: [Case Witnesses]
 *     parameters:
 *       - in: path
 *         name: incidentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of witnesses
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
 *                       incident_id:
 *                         type: string
 *                       full_name:
 *                         type: string
 *                       gender:
 *                         type: string
 *                       age:
 *                         type: integer
 *                       mobile_number:
 *                         type: string
 *                       email:
 *                         type: string
 *                       witness_type:
 *                         type: string
 *                       statement:
 *                         type: string
 *
 * /case-witnesses/{id}:
 *   get:
 *     summary: Get a single witness by ID
 *     tags: [Case Witnesses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Witness detail
 *       404:
 *         description: Witness not found
 *   put:
 *     summary: Update a witness
 *     tags: [Case Witnesses]
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
 *         description: Witness updated
 *   delete:
 *     summary: Delete a witness
 *     tags: [Case Witnesses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Witness deleted
 */
