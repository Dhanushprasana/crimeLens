/**
 * @openapi
 * /crimes:
 *   post:
 *     summary: Create a crime incident (evidences and officer assignments can be included)
 *     tags: [Crimes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: Armed Robbery at Central Market
 *               description:
 *                 type: string
 *                 example: Suspect was armed and fled on foot heading north.
 *               crime_number:
 *                 type: string
 *                 example: CR-2024-00142
 *               crime_category_id:
 *                 type: string
 *                 example: "12345"
 *               police_station_id:
 *                 type: string
 *                 example: "67890"
 *               crime_happended_at_district_id:
 *                 type: string
 *                 example: "11111"
 *               status:
 *                 type: string
 *                 enum: [UNDER_INVESTIGATION, SOLVED, CLOSED, PENDING]
 *                 default: UNDER_INVESTIGATION
 *               crime_occured_date_time:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-06-15T14:30:00"
 *               incident_registered_date:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-06-15T16:00:00"
 *               fir_id:
 *                 type: string
 *               created_by:
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
 *                     description:
 *                       type: string
 *                     evidence_number:
 *                       type: string
 *                     uploaded_by:
 *                       type: string
 *               officer_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["11111", "22222"]
 *     responses:
 *       200:
 *         description: Crime incident created successfully
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
 *                     id:
 *                       type: string
 *                       example: "3456789"
 *       400:
 *         description: Validation error (e.g. missing title)
 *       500:
 *         description: Internal server error
 *
 *   get:
 *     summary: List crime incidents with pagination, filtering, search and sorting
 *     tags: [Crimes]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number (1-indexed)
 *         example: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of records per page (max 100)
 *         example: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Full-text search across crime_number, title, and description (SQL LIKE)
 *         example: robbery
 *       - in: query
 *         name: districtId
 *         schema:
 *           type: string
 *         description: Filter by district ROWID
 *         example: "11111"
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: string
 *         description: Filter by police station ROWID
 *         example: "67890"
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filter by crime category ROWID
 *         example: "12345"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [UNDER_INVESTIGATION, SOLVED, CLOSED, PENDING]
 *         description: Filter by incident status
 *         example: UNDER_INVESTIGATION
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter for an exact calendar day (YYYY-MM-DD). Overrides from/to when present.
 *         example: "2024-06-15"
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date of an inclusive date range (YYYY-MM-DD). Used with or without `to`.
 *         example: "2024-01-01"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date of an inclusive date range (YYYY-MM-DD). Used with or without `from`.
 *         example: "2024-12-31"
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [crime_occured_date_time, createdtime, crime_number, status]
 *           default: crime_occured_date_time
 *         description: Column to sort results by
 *         example: crime_occured_date_time
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: Sort direction
 *         example: DESC
 *     responses:
 *       200:
 *         description: Paginated list of crime incidents
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
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           ROWID:
 *                             type: string
 *                           crime_number:
 *                             type: string
 *                           title:
 *                             type: string
 *                           crime_category_id:
 *                             type: string
 *                           police_station_id:
 *                             type: string
 *                           crime_happended_at_district_id:
 *                             type: string
 *                           status:
 *                             type: string
 *                           crime_occured_date_time:
 *                             type: string
 *                           createdtime:
 *                             type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         pageSize:
 *                           type: integer
 *                           example: 20
 *                         totalRecords:
 *                           type: integer
 *                           example: 250
 *                         totalPages:
 *                           type: integer
 *                           example: 13
 *                         hasNext:
 *                           type: boolean
 *                           example: true
 *                         hasPrevious:
 *                           type: boolean
 *                           example: false
 *       400:
 *         description: Invalid query parameter value
 *       500:
 *         description: Internal server error
 *
 * /crimes/getOneCrime/{id}:
 *   get:
 *     summary: Get a single crime incident by ID (includes full evidences array)
 *     tags: [Crimes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Catalyst ROWID of the crime incident
 *         example: "3456789"
 *     responses:
 *       200:
 *         description: Crime incident detail with evidences
 *       404:
 *         description: Crime not found
 *       500:
 *         description: Internal server error
 *
 * /crimes/{id}:
 *   put:
 *     summary: Update a crime incident (replaces evidences if provided)
 *     tags: [Crimes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Catalyst ROWID of the crime incident
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Any subset of crime incident fields. If evidences array is provided, existing evidences are replaced.
 *     responses:
 *       200:
 *         description: Crime updated successfully
 *       500:
 *         description: Internal server error
 *   delete:
 *     summary: Delete a crime incident by ID
 *     tags: [Crimes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Catalyst ROWID of the crime incident
 *     responses:
 *       200:
 *         description: Crime deleted successfully
 *       500:
 *         description: Internal server error
 */
