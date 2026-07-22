"use strict";

const repository = require("./user-invites.repository");
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
    const bcrypt = require("bcrypt");
    
    // sysUserId = ROWID of sys_user (created during invite)
    if (!dto || !dto.sysUserId)
      throw new Error("sysUserId is required");
    if (!dto.password)
      throw new Error("password is required");

    // Look up user_info via sys_user join
    const userInfo = await repository.getUserInfoBySysUserId(dto.sysUserId, req);
    if (!userInfo) throw new Error("User not found");

    // Verify invite exists and hasn't been used
    const invite = await repository.getLatestInviteByEmail(userInfo.email, req);
    if (!invite) throw new Error("Invite not found");
    if (invite.is_account_setup) throw new Error("Account already setup");

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    
    // Save password
    await repository.createPassword(dto.sysUserId, hashedPassword, req);

    // If invited as an officer, create the police officer record
    if (userInfo.isOfficer === true || userInfo.isOfficer === 'true') {
      await repository.createPoliceOfficer(dto.sysUserId, userInfo, req);
    }

    // Update invite status
    await repository.markInviteAccountSetup(invite.ROWID, req);

    return {
      message: "Account registration completed. The user can now log in.",
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