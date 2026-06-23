/**
 * @openapi
 * /police/officers:
 *   post:
 *     summary: Create a police officer
 *     tags: [Police Officers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               badge_number:
 *                 type: string
 *               rank_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Officer created
 *
 *   get:
 *     summary: Get all police officers
 *     tags: [Police Officers]
 *     responses:
 *       200:
 *         description: List of officers
 *
 */

/**
 * @openapi
 * /police/officers/getAll:
 *   get:
 *     summary: Get all officers with pagination
 *     tags: [Police Officers]
 *     responses:
 *       200:
 *         description: List of officers
 */

/**
 * @openapi
 * /police/officers/getOneOfficer/{id}:
 *   get:
 *     summary: Get single officer
 *     tags: [Police Officers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Officer details
 *   put:
 *     summary: Update officer
 *     tags: [Police Officers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Officer updated
 *   delete:
 *     summary: Soft delete officer
 *     tags: [Police Officers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Officer soft deleted
 */

/**
 * @openapi
 * /police/officers/ranks:
 *   post:
 *     summary: Create police rank
 *     tags: [Police Ranks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rank_name:
 *                 type: string
 *               hierarchy_level:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Rank created
 *   get:
 *     summary: Get all ranks
 *     tags: [Police Ranks]
 *     responses:
 *       200:
 *         description: List of ranks
 *
 * /police/officers/ranks/{id}:
 *   delete:
 *     summary: Delete rank
 *     tags: [Police Ranks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Rank deleted
 */
