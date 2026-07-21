"use strict";

const repository = require("./user-invites.repository");
const catalystAuth = require("../../../catalyst/auth/auth");
const catalystMail = require("../../../catalyst/mail/mail");
const logger = require("../../../config/logger");

module.exports = {
  async inviteUser(dto, req) {
    logger.info("inviteUser called");

    // ── Validate required fields ────────────────────────────────────────────
    if (!dto || !dto.email) throw new Error("email is required");
    if (!dto.role_name) {
      throw new Error(
        "role_name is required. Please create a role first and provide the role_name.",
      );
    }

    // ── Resolve role name → role row ────────────────────────────────────────
    const role = await repository.getRoleByName(dto.role_name, req);
    if (!role) {
      // Fetch available roles so the caller knows what to choose from
      const availableRoles = await repository.getAllRoles(req);
      const roleList =
        availableRoles.length > 0
          ? availableRoles.map((r) => `• ${r.role_name}`).join("\n")
          : "No roles exist yet.";

      throw Object.assign(
        new Error(
          `Role "${dto.role_name}" does not exist. ` +
          `Please create the role first and then retry the invite.\n` +
          `Available roles:\n${roleList}`,
        ),
        { statusCode: 400, code: "ROLE_NOT_FOUND", availableRoles },
      );
    }

    // Attach the resolved ROWID so the repository can use it
    dto.resolvedRoleId = role.ROWID;

    // ── Create user_info + invite + user_role records ───────────────────────
    const invite = await repository.createInvite(dto, req);

    // ── Send invitation email ───────────────────────────────────────────────
    // NOTE: Catalyst mail only works when deployed; falls back gracefully in local dev.
    const BASE_URL = process.env.CALLBACK_URL || "http://localhost:3000";
    const link = `${BASE_URL}/user/invite?token=${invite.invite_token}`;
    try {
      await catalystMail.sendMail(
        req,
        dto.email,
        "You are invited",
        [`Please accept invite: ${link}`],
        { url: link, text: "Accept Invite" },
      );
    } catch (mailErr) {
      logger.warn(`Invite created but email could not be sent: ${mailErr.message}`);
    }

    return {
      ...invite,
      role: { id: role.ROWID, name: role.role_name },
    };
  },

  async getAllInvites(query, req) {
    logger.info("getAllInvites");
    return repository.getAllInvites(query, req);
  },

  async checkInvite(dto, req) {
    logger.info("checkInvite");
    return repository.checkInvite(dto, req);
  },

  async acceptInvite(dto, req) {
    logger.info("acceptInvite");
    return repository.acceptInvite(dto, req);
  },

  async createUserFromInvite(dto, req) {
    logger.info("createUserFromInvite");
    // sysUserId = ROWID of sys_user (created during invite)
    if (!dto || !dto.sysUserId)
      throw new Error("sysUserId is required");

    // Look up user_info via sys_user join
    const userInfo = await repository.getUserInfoBySysUserId(dto.sysUserId, req);
    if (!userInfo) throw new Error("User not found");

    // Register user in Catalyst Auth.
    // NOTE: Catalyst's registerUser() does NOT accept a password — it sends its own
    // "Set up your account" activation email where the user sets their password securely.
    // Any password passed here is silently ignored by Catalyst.
    // The frontend should inform the user to check their email to complete account setup.
    const catalystUser = await catalystAuth.createUser(
      req,
      userInfo.email,
      null, // password intentionally omitted — Catalyst manages this
      `${userInfo.user_first_name || ""} ${userInfo.user_last_name || ""}`.trim() ||
      null,
    );

    // Resolve the Catalyst user identifier from the response
    const catalystUserId =
      catalystUser?.user_details?.user_id ||
      catalystUser?.user_details?.userid ||
      catalystUser?.id ||
      catalystUser?.user_id ||
      catalystUser?.ROWID ||
      null;

    // Update catalyst_user_id on the existing sys_user row
    const saved = await repository.linkCatalystUser(
      dto.sysUserId,
      catalystUserId,
      req,
    );

    return {
      ...saved,
      message:
        "Account registration initiated. The user will receive an activation email from Catalyst to set their password.",
    };
  },

  async resendInvite(dto, req) {
    logger.info("resendInvite");
    const invite = await repository.getLatestInviteByEmail(dto.email, req);
    if (!invite) throw new Error("No existing invite found for this email");

    const updated = await repository.resendInvite(dto, req);
    const BASE_URL = process.env.CALLBACK_URL || "http://localhost:3000";
    const link = `${BASE_URL}/user/invite?token=${updated.invite_token}`;
    try {
      await catalystMail.sendMail(
        req,
        dto.email,
        "Invite - Reminder",
        [`Please accept invite: ${link}`],
        { url: link, text: "Accept Invite" },
      );
    } catch (mailErr) {
      logger.warn(`Reinvite token updated but email could not be sent: ${mailErr.message}`);
    }
    return updated;
  },
};