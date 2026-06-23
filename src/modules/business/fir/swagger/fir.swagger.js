/**
 * @openapi
 * /firs:
 *   post:
 *     summary: Create a FIR (developer)
 *     tags: [FIRs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               complainant_name:
 *                 type: string
 *               incident_description:
 *                 type: string
 *     responses:
 *       200:
 *         description: FIR created
 *   get:
 *     summary: Get all FIRs
 *     tags: [FIRs]
 *     responses:
 *       200:
 *         description: List of FIRs
 *
 * /firs/getOneFir/{id}:
 *   get:
 *     summary: Get FIR by id
 *     tags: [FIRs]
 *   put:
 *     summary: Update FIR
 *     tags: [FIRs]
 *   delete:
 *     summary: Delete FIR (developer)
 *     tags: [FIRs]
 */
