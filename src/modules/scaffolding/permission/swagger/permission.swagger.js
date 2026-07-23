/**
 * @openapi
 * /permissions:
 *   post:
 *     summary: Create bulk permissions
 *     tags: [Permissions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required:
 *                 - name
 *               properties:
 *                 name:
 *                   type: string
 *                   example: "read:users"
 *                 description:
 *                   type: string
 *                   example: "Allows reading user details"
 *                 type:
 *                   type: string
 *                   enum: [system, business]
 *                   example: "system"
 *                 parentName:
 *                   type: string
 *                   example: "Dashboard"
 *     responses:
 *       200:
 *         description: Permissions created successfully
 *       500:
 *         description: Server error
 *   get:
 *     summary: Get all system and business permissions
 *     tags: [Permissions]
 *     responses:
 *       200:
 *         description: List of permissions
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /permissions/{id}:
 *   put:
 *     summary: Update permission by ID
 *     tags: [Permissions]
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
 *             properties:
 *               name:
 *                 type: string
 *                 example: "write:users"
 *               description:
 *                 type: string
 *                 example: "Allows editing user details"
 *     responses:
 *       200:
 *         description: Permission updated successfully
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Soft delete permission by ID
 *     tags: [Permissions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Permission soft-deleted (hard-deleted as fallback)
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /permissions/{id}/restore:
 *   post:
 *     summary: Restore a soft-deleted permission (not supported on current schema)
 *     tags: [Permissions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       500:
 *         description: Restore not supported
 */

/**
 * @openapi
 * /permissions/{id}/hard:
 *   delete:
 *     summary: Hard delete permission by ID
 *     tags: [Permissions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Permission hard-deleted
 *       500:
 *         description: Server error
 */
