/**
 * @openapi
 * /roles:
 *   post:
 *     summary: Create a new role
 *     tags: [Roles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: CONTRIBUTOR
 *               isDefault:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Role created successfully
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /roles/getAll:
 *   get:
 *     summary: Get all roles
 *     tags: [Roles]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isDetailed
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of roles
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /roles/{id}:
 *   get:
 *     summary: Get single role by ID
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role details
 *       500:
 *         description: Server error
 *   put:
 *     summary: Update role and its permissions
 *     tags: [Roles]
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
 *                 example: CONTRIBUTOR_UPDATED
 *               permission:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete a role
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /roles/{id}/restore:
 *   post:
 *     summary: Restore a soft-deleted role (not supported on current schema)
 *     tags: [Roles]
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
 * /roles/permissions:
 *   post:
 *     summary: Create role with a list of nested permissions
 *     tags: [Roles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleName
 *               - nestedPermissions
 *             properties:
 *               roleName:
 *                 type: string
 *                 example: MANAGER
 *               nestedPermissions:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Role and permissions created and linked
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /roles/{roleId}/mapPermissions:
 *   post:
 *     summary: Map list of permission names to an existing role
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissionNames
 *             properties:
 *               permissionNames:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["read:users", "write:users"]
 *     responses:
 *       200:
 *         description: Permissions mapped successfully
 *       500:
 *         description: Server error
 */
