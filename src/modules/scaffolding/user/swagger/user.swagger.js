/**
 * @openapi
 * /users:
		requestBody:
			required: true
			content:
				application/json:
					schema:
						type: object
						required:
							- name
							- email
							- password
						properties:
							name:
								type: string
								example: John Doe
							email:
								type: string
								example: john.doe@example.com
							password:
								type: string
								example: "P@ssw0rd!"
							phone:
								type: string
								example: "+1234567890"
							roleIds:
								type: array
								items:
									type: string
								example: ["46044000000024730"]
							catalystUserId:
								type: string
								example: "1234567"
		responses:
			200:
				description: User created successfully
				content:
					application/json:
						schema:
							type: object
							properties:
								id:
									type: string
									example: "46044000000012345"
								isArchived:
									type: boolean
									example: false
								userInfo:
									type: object
									properties:
										id:
											type: string
											example: "46044000000054321"
										name:
											type: string
											example: "John Doe"
										email:
											type: string
											example: "john.doe@example.com"
										phone:
											type: string
											example: "+1234567890"
										roleDetails:
											type: array
											items:
												type: object
												properties:
													id:
														type: string
														example: "46044000000024730"
													name:
														type: string
														example: "SUPER_ADMIN"
			500:
				description: Server error
 *         description: User created successfully
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Hard delete users by email list
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emails
 *             properties:
 *               emails:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["john.doe@example.com"]
 *     responses:
 *       200:
 *         description: Users deleted successfully
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /users/getAll:
 *   get:
 *     summary: Get all users (V1)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Page limit
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter status
 *     responses:
 *       200:
 *         description: List of users
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /users/{id}/restore:
 *   post:
 *     summary: Restore a soft-deleted user (not supported on current schema)
 *     tags: [Users]
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
 * /users/getAllUsers:
 *   get:
 *     summary: Get all users V2 (includes invitations and requests summary)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Enriched/flattened users list
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /users/role:
 *   put:
 *     summary: Update a user's role by email
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - roleName
 *             properties:
 *               email:
 *                 type: string
 *                 example: john.doe@example.com
 *               roleName:
 *                 type: string
 *                 example: SUPER_ADMIN
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /users/deactivate/{email}:
 *   patch:
 *     summary: Deactivate a user account by email
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deactivated
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /users/activate/{email}:
 *   patch:
 *     summary: Activate a deactivated user account by email
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User activated
 *       500:
 *         description: Server error
 */
