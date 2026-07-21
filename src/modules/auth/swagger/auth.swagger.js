/**
 * @openapi
 * tags:
 *   name: Auth
 *   description: Authentication and current user endpoints
 * 
 * /auth/me:
 *   get:
 *     summary: Get user details by email
 *     description: Returns the details of a user by email, including their sys_user_id, user_info_id, and assigned roles. (Replaces token-based get me for local testing without Catalyst session).
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *         required: true
 *         description: The email address of the user to fetch
 *     responses:
 *       200:
 *         description: Current user information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   description: The Catalyst user object
 *                 sys_user_id:
 *                   type: string
 *                   description: The ROWID of the sys_user record associated with the current user
 *                   nullable: true
 *                 user_info_id:
 *                   type: string
 *                   description: The ROWID of the sys_user_info record associated with the current user
 *                   nullable: true
 *                 roles:
 *                   type: array
 *                   description: The roles assigned to the current user
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: The role ID
 *                       name:
 *                         type: string
 *                         description: The role name
 *       401:
 *         description: Unauthorized - No valid token provided
 *       500:
 *         description: Internal server error
 * 
 * /auth/logout:
 *   post:
 *     summary: Log out current user
 *     description: Logs out the current user and invalidates the session.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
