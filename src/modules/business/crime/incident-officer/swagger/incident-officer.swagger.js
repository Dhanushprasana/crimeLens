/**
 * @openapi
 * /incident-officers:
 *   post:
 *     summary: Assign an officer to a crime incident
 *     tags: [Incident Officers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - incident_id
 *               - officer_id
 *             properties:
 *               incident_id:
 *                 type: string
 *                 example: "46044000000111111"
 *               officer_id:
 *                 type: string
 *                 example: "46044000000222222"
 *     responses:
 *       200:
 *         description: Officer assigned to incident
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
 * /incident-officers/byIncident/{incidentId}:
 *   get:
 *     summary: Get all officers assigned to a specific incident
 *     tags: [Incident Officers]
 *     parameters:
 *       - in: path
 *         name: incidentId
 *         required: true
 *         schema:
 *           type: string
 *         example: "46044000000111111"
 *     responses:
 *       200:
 *         description: List of officer assignments
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
 *                       officer_id:
 *                         type: string
 *
 * /incident-officers/byOfficer/{officerId}:
 *   get:
 *     summary: Get all incidents assigned to a specific officer
 *     tags: [Incident Officers]
 *     parameters:
 *       - in: path
 *         name: officerId
 *         required: true
 *         schema:
 *           type: string
 *         example: "46044000000222222"
 *     responses:
 *       200:
 *         description: List of incident assignments
 *
 * /incident-officers/{id}:
 *   delete:
 *     summary: Remove an officer from an incident (by assignment row ID)
 *     tags: [Incident Officers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ROWID of the biz_incident_officer record
 *     responses:
 *       200:
 *         description: Officer removed from incident
 */
