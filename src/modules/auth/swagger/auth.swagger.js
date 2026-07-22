/**
 * @openapi
 * tags:
 *   name: Auth
 *   description: Authentication and current user endpoints
 * 
 * /auth/login:
 *   post:
 *     summary: Log in a user
 *     description: Authenticates a user by email and password, and returns JWT access and refresh tokens.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 sessionId:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 * 
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Uses a refresh token and session ID to issue a new access token.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *               - sessionId
 *             properties:
 *               refreshToken:
 *                 type: string
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *       401:
 *         description: Invalid or expired refresh token
 * 
 * /auth/me:
 *   get:
 *     summary: Get current user details
 *     description: Returns the details of the authenticated user based on the JWT token.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
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
 *                 sys_user_id:
 *                   type: string
 *                 user_info_id:
 *                   type: string
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized - No valid token provided
 *       500:
 *         description: Internal server error
 * 
 * /auth/logout:
 *   post:
 *     summary: Log out current user
 *     description: Logs out the current user and invalidates the session in the database.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *             properties:
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully logged out
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
