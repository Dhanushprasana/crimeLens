/**
 * @openapi
 * /users/invites/invite:
 *   post:
 *     summary: Invite a user by email and assign a role
 *     description: |
 *       Creates a `sys_user_info` record, a `sys_user_invite` record, and a
 *       `sys_user_role` mapping in one call.
 *
 *       The `role_name` is resolved to its ROWID on the backend.
 *       If the role does not exist, the API returns a **400** error listing
 *       all currently available roles so you know which names are valid.
 *       Create the role first (via `POST /roles`) and then retry the invite.
 *     tags: [User Invites]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - role_name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address of the person being invited
 *                 example: john.doe@example.com
 *               first_name:
 *                 type: string
 *                 description: First name of the invitee
 *                 example: John
 *               last_name:
 *                 type: string
 *                 description: Last name of the invitee
 *                 example: Doe
 *               phone:
 *                 type: string
 *                 description: Phone number of the invitee (optional)
 *                 example: "9876543210"
 *               role_name:
 *                 type: string
 *                 description: |
 *                   Name of the role to assign (e.g. "ADMIN", "OFFICER").
 *                   The backend looks up the matching role by name.
 *                   If the role does not exist, a 400 error is returned with the list of available roles.
 *                 example: OFFICER
 *               invited_by:
 *                 type: string
 *                 description: ROWID of the sys_user record of the person sending the invite
 *                 example: "46044000000031234"
 *     responses:
 *       200:
 *         description: Invite created, email sent, and role assigned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: ROWID of the new sys_user_invite row
 *                 sys_user_id:
 *                   type: string
 *                   description: ROWID of the newly created sys_user row (use this for onboarding)
 *                 user_info_id:
 *                   type: string
 *                   description: ROWID of the newly created sys_user_info row
 *                 invite_token:
 *                   type: string
 *                   description: Token hash included in the invite link
 *                 role:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: ROWID of the assigned role
 *                     name:
 *                       type: string
 *                       description: Name of the assigned role
 *       400:
 *         description: Validation error — missing fields or role not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: |
 *                     Role "SUPER_USER" does not exist. Please create the role first and then retry the invite.
 *                     Available roles:
 *                     • ADMIN
 *                     • OFFICER
 *                 code:
 *                   type: string
 *                   example: ROLE_NOT_FOUND
 *                 availableRoles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       ROWID:
 *                         type: string
 *                       role_name:
 *                         type: string
 *
 * /users/invites/invites:
 *   get:
 *     summary: Get all invites
 *     tags: [User Invites]
 *     responses:
 *       200:
 *         description: List of all sys_user_invite records
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
 *             required:
 *               - inviteToken
 *             properties:
 *               inviteToken:
 *                 type: string
 *                 description: The invite_token_hash value from the invite link
 *                 example: "a3f8c2..."
 *     responses:
 *       200:
 *         description: Invite details if token is valid
 *
 * /users/invites/invite/accept:
 *   post:
 *     summary: Accept an invite (marks is_accepted = true)
 *     tags: [User Invites]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inviteToken
 *             properties:
 *               inviteToken:
 *                 type: string
 *                 description: The invite_token_hash value from the invite link
 *     responses:
 *       200:
 *         description: Invite accepted successfully
 *
 * /users/invites/invite/onboard:
 *   post:
 *     summary: Onboard a user from an accepted invite (registers in Catalyst Auth)
 *     description: |
 *       Registers the user in Catalyst's authentication system using the email stored in sys_user_info.
 *
 *       **Important:** Catalyst does not accept a password via the API.
 *       After this call, Catalyst sends an **activation email** to the user with a secure link
 *       where they set their own password. The user must click that link to activate their account.
 *       Inform the user to check their inbox (including spam) after onboarding.
 *     tags: [User Invites]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sysUserId
 *             properties:
 *               sysUserId:
 *                 type: string
 *                 description: ROWID of the sys_user record (returned in the invite response as sys_user_id)
 *     responses:
 *       201:
 *         description: Catalyst account created — activation email sent to the user
 *
 * /users/invites/reinvite:
 *   post:
 *     summary: Resend an invite (generates a new token)
 *     tags: [User Invites]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address of the previously invited user
 *     responses:
 *       200:
 *         description: New invite token generated and email resent
 */
