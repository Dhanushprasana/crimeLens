/**
 * @openapi
 * /criminal-profiling/{criminalId}/generate:
 *   post:
 *     summary: Generate or regenerate criminal profile (V2)
 *     description: >
 *       Generates a comprehensive criminal profile using intelligence data
 *       including behavioral flags, phone records, vehicle records,
 *       crime severity analysis, network intelligence, and risk explainability.
 *     tags: [Profiling]
 *     parameters:
 *       - in: path
 *         name: criminalId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the criminal to profile
 *     responses:
 *       200:
 *         description: Profile successfully generated or regenerated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Profile regenerated
 *                     criminal:
 *                       type: object
 *                     profile:
 *                       type: object
 *                       properties:
 *                         criminal_id:
 *                           type: string
 *                         risk_score:
 *                           type: number
 *                           description: Composite risk score (0-100)
 *                         threat_level:
 *                           type: string
 *                           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *                         crime_frequency:
 *                           type: number
 *                         active_years:
 *                           type: number
 *                         primary_crime_type:
 *                           type: string
 *                           nullable: true
 *                         profile_summary:
 *                           type: string
 *                         profile_type:
 *                           type: string
 *                           enum: [Career Criminal, Gang Associate, Repeat Offender, Low-Level Offender]
 *                         associate_count:
 *                           type: number
 *                         primary_district:
 *                           type: string
 *                           nullable: true
 *                           description: ROWID of the primary district (FK)
 *                         last_activity_date:
 *                           type: string
 *                           nullable: true
 *                     riskFactors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           factor_name:
 *                             type: string
 *                           factor_score:
 *                             type: number
 *                           factor_description:
 *                             type: string
 *       500:
 *         description: Server error
 *
 * /criminal-profiling/{criminalId}:
 *   get:
 *     summary: Get criminal profile by criminal ID
 *     tags: [Profiling]
 *     parameters:
 *       - in: path
 *         name: criminalId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the criminal
 *     responses:
 *       200:
 *         description: Criminal profile details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     ROWID:
 *                       type: string
 *                     criminal_id:
 *                       type: string
 *                     risk_score:
 *                       type: number
 *                     threat_level:
 *                       type: string
 *                     crime_frequency:
 *                       type: number
 *                     active_years:
 *                       type: number
 *                     primary_crime_type:
 *                       type: string
 *                       nullable: true
 *                     profile_summary:
 *                       type: string
 *                     profile_type:
 *                       type: string
 *                       enum: [Career Criminal, Gang Associate, Repeat Offender, Low-Level Offender]
 *                     associate_count:
 *                       type: number
 *                     primary_district:
 *                       type: string
 *                       nullable: true
 *                     last_activity_date:
 *                       type: string
 *                       nullable: true
 *                     CREATEDTIME:
 *                       type: string
 *                     MODIFIEDTIME:
 *                       type: string
 *       500:
 *         description: Server error
 *
 * /criminal-profiling/{criminalId}/risk-factors:
 *   get:
 *     summary: Get risk factors for a criminal profile
 *     description: >
 *       Returns the criminal profile along with computed risk explainability
 *       factors that break down the risk score into named components.
 *     tags: [Profiling]
 *     parameters:
 *       - in: path
 *         name: criminalId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the criminal
 *     responses:
 *       200:
 *         description: Profile with risk factors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     profile:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         ROWID:
 *                           type: string
 *                         criminal_id:
 *                           type: string
 *                         risk_score:
 *                           type: number
 *                         threat_level:
 *                           type: string
 *                         crime_frequency:
 *                           type: number
 *                         profile_type:
 *                           type: string
 *                         profile_summary:
 *                           type: string
 *                     riskFactors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           ROWID:
 *                             type: string
 *                           profile_id:
 *                             type: string
 *                           factor_name:
 *                             type: string
 *                           factor_score:
 *                             type: number
 *                           factor_description:
 *                             type: string
 *       500:
 *         description: Server error
 */
