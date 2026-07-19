/**
 * @openapi
 * tags:
 *   - name: Evidence Match
 *     description: CRUD endpoints for sys_evidence_match - linking matched evidence records
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     EvidenceMatch:
 *       type: object
 *       properties:
 *         ROWID:
 *           type: string
 *           description: Auto-generated record ID
 *         source_evidence_id:
 *           type: string
 *           description: ROWID of the source evidence record (FK → biz_crime_evidence)
 *         matched_evidence_id:
 *           type: string
 *           description: ROWID of the matched evidence record (FK → biz_crime_evidence)
 *         evidence_type:
 *           type: string
 *           description: Type of evidence match (e.g. fingerprint, DNA, image)
 *         confidence:
 *           type: string
 *           description: Confidence score or description of the match
 *         verified:
 *           type: boolean
 *           default: false
 *           description: Whether this match has been manually verified
 *
 *     EvidenceMatchInput:
 *       type: object
 *       required:
 *         - source_evidence_id
 *         - matched_evidence_id
 *         - evidence_type
 *       properties:
 *         source_evidence_id:
 *           type: string
 *         matched_evidence_id:
 *           type: string
 *         evidence_type:
 *           type: string
 *         confidence:
 *           type: string
 *         verified:
 *           type: boolean
 *           default: false
 */

/**
 * @openapi
 * /evidence-matches:
 *   post:
 *     summary: Create a new evidence match
 *     tags: [Evidence Match]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EvidenceMatchInput'
 *           example:
 *             source_evidence_id: "46044000000395871"
 *             matched_evidence_id: "46044000000395900"
 *             evidence_type: "fingerprint"
 *             confidence: "0.97"
 *             verified: false
 *     responses:
 *       201:
 *         description: Evidence match created successfully
 *       400:
 *         description: Validation error - missing required fields
 *       500:
 *         description: Server error
 *
 *   get:
 *     summary: Get all evidence matches
 *     tags: [Evidence Match]
 *     responses:
 *       200:
 *         description: List of all evidence matches
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EvidenceMatch'
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /evidence-matches/{id}:
 *   get:
 *     summary: Get a single evidence match by ID
 *     tags: [Evidence Match]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ROWID of the evidence match
 *     responses:
 *       200:
 *         description: Evidence match record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EvidenceMatch'
 *       404:
 *         description: Evidence match not found
 *       500:
 *         description: Server error
 *
 *   put:
 *     summary: Update an evidence match
 *     tags: [Evidence Match]
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
 *             $ref: '#/components/schemas/EvidenceMatchInput'
 *           example:
 *             confidence: "0.99"
 *             verified: true
 *     responses:
 *       200:
 *         description: Evidence match updated
 *       404:
 *         description: Evidence match not found
 *       500:
 *         description: Server error
 *
 *   delete:
 *     summary: Delete an evidence match
 *     tags: [Evidence Match]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Evidence match deleted
 *       404:
 *         description: Evidence match not found
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /evidence-matches/source/{sourceId}:
 *   get:
 *     summary: Get all matches for a given source evidence
 *     tags: [Evidence Match]
 *     parameters:
 *       - in: path
 *         name: sourceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ROWID of the source evidence record
 *     responses:
 *       200:
 *         description: List of evidence matches for the source evidence
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EvidenceMatch'
 *       400:
 *         description: sourceId is required
 *       500:
 *         description: Server error
 */

module.exports = {};
