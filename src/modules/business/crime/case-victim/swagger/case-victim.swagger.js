/**
 * @openapi
 * /case-victims:
 *   post:
 *     summary: Add a victim to a crime incident
 *     tags: [Case Victims]
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
 *                 example: Priya Sharma
 *               gender:
 *                 type: string
 *                 example: FEMALE
 *               mobile_number:
 *                 type: string
 *                 example: "9123456789"
 *               email:
 *                 type: string
 *                 example: priya@example.com
 *               address:
 *                 type: string
 *                 example: 5 Park Lane, Mumbai
 *               occupation:
 *                 type: string
 *                 example: Engineer
 *               injury_type:
 *                 type: string
 *                 example: PHYSICAL
 *               medical_report_number:
 *                 type: string
 *                 example: MED-2024-0099
 *               alive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Victim added
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
 * /case-victims/byIncident/{incidentId}:
 *   get:
 *     summary: Get all victims for a specific incident
 *     tags: [Case Victims]
 *     parameters:
 *       - in: path
 *         name: incidentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of victims
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
 *                       mobile_number:
 *                         type: string
 *                       email:
 *                         type: string
 *                       injury_type:
 *                         type: string
 *                       medical_report_number:
 *                         type: string
 *                       alive:
 *                         type: boolean
 *
 * /case-victims/{id}:
 *   get:
 *     summary: Get a single victim by ID
 *     tags: [Case Victims]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Victim detail
 *       404:
 *         description: Victim not found
 *   put:
 *     summary: Update a victim
 *     tags: [Case Victims]
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
 *         description: Victim updated
 *   delete:
 *     summary: Delete a victim
 *     tags: [Case Victims]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Victim deleted
 */
