/**
 * @openapi
 * /users/invites/invite:
 *   post:
 *     summary: Create and send an invite to a user email
 *     tags: [User Invites]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               invited_by:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invite created and email sent
 *
 * /users/invites/invites:
 *   get:
 *     summary: Get all invites
 *     tags: [User Invites]
 *     responses:
 *       200:
 *         description: List of invites
 *
 * /users/invites/invite/check:
 *   post:
 *     summary: Check invite token validity
 *     tags: [User Invites]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inviteToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invite details
 *
 * /users/invites/invite/accept:
 *   post:
 *     summary: Accept an invite (mark accepted)
 *     tags: [User Invites]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inviteToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invite accepted
 *
 * /users/invites/invite/onboard:
 *   post:
 *     summary: Create Catalyst user from invite (passwordless support)
 *     tags: [User Invites]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userInfoId:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Catalyst user created and linked
 *
 * /users/invites/reinvite:
 *   post:
 *     summary: Resend an invite
 *     tags: [User Invites]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invite resent
 */
