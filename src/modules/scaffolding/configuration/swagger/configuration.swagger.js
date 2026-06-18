/**
 * @openapi
 * /configurations:
 *   put:
 *     summary: Upsert configuration (branding/email etc.)
 *     tags: [Configurations]
 *     parameters:
 *       - in: header
 *         name: x-user-id
 *         required: false
 *         schema:
 *           type: string
 *         description: Required for branding configurations
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - config
 *             properties:
 *               name:
 *                 type: string
 *                 example: branding
 *               config:
 *                 type: object
 *                 properties:
 *                   logo:
 *                     type: string
 *                     example: "/assets/logo.png"
 *     responses:
 *       200:
 *         description: Configuration saved successfully
 *       500:
 *         description: Server error
 *   get:
 *     summary: Get all configurations
 *     tags: [Configurations]
 *     parameters:
 *       - in: header
 *         name: x-user-id
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of configurations
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /configurations/upload-path:
 *   put:
 *     summary: Update upload path specifically
 *     tags: [Configurations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - path
 *             properties:
 *               path:
 *                 type: string
 *                 example: "/var/www/uploads"
 *     responses:
 *       200:
 *         description: Upload path updated successfully
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /configurations/{name}:
 *   get:
 *     summary: Get specific configuration by name
 *     tags: [Configurations]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-user-id
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Configuration details
 *       500:
 *         description: Server error
 */
