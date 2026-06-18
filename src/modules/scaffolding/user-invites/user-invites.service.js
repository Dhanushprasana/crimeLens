"use strict";

const repository = require("./user-invites.repository");
const catalystAuth = require("../../../catalyst/auth/auth");
const catalystMail = require("../../../catalyst/mail/mail");
const logger = require("../../../config/logger");

module.exports = {
  async inviteUser(dto, req) {
    logger.info("inviteUser called");
    if (!dto || !dto.email) throw new Error("email required");
    // create invite record and send email via catalyst mail
    const invite = await repository.createInvite(dto, req);
    // send mail using catalyst adapter
    const BASE_URL = process.env.CALLBACK_URL || "http://localhost:3000";
    const link = `${BASE_URL}/user/invite?token=${invite.invite_token}`;
    await catalystMail.sendMail(
      req,
      dto.email,
      "You are invited",
      [`Please accept invite: ${link}`],
      { url: link, text: "Accept Invite" },
    );
    return invite;
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
    if (!dto || !dto.userInfoId || !dto.password)
      throw new Error("userInfoId and password required");
    // lookup user info to get email/name
    const userInfo = await repository.getUserInfoById(dto.userInfoId, req);
    if (!userInfo) throw new Error("UserInfo not found");

    // create user in Catalyst Auth using email from userInfo
    const catalystUser = await catalystAuth.createUser(
      req,
      userInfo.email,
      dto.password,
      `${userInfo.user_first_name || ""} ${userInfo.user_last_name || ""}`.trim() ||
        null,
    );
    // persist mapping
    // persist mapping (store catalyst user identifier)
    const catalystUserId =
      catalystUser &&
      (catalystUser.id || catalystUser.user_id || catalystUser.ROWID)
        ? catalystUser.id || catalystUser.user_id || catalystUser.ROWID
        : catalystUser;
    const saved = await repository.linkCatalystUser(
      dto.userInfoId,
      catalystUserId,
      req,
    );
    return saved;
  },

  async resendInvite(dto, req) {
    logger.info("resendInvite");
    const invite = await repository.getLatestInviteByEmail(dto.email, req);
    if (!invite) throw new Error("No existing invite");
    // create new token and update
    const updated = await repository.resendInvite(dto, req);
    const BASE_URL = process.env.CALLBACK_URL || "http://localhost:3000";
    const link = `${BASE_URL}/user/invite?token=${updated.invite_token}`;
    await catalystMail.sendMail(
      req,
      dto.email,
      "Invite - Reminder",
      [`Please accept invite: ${link}`],
      { url: link, text: "Accept Invite" },
    );
    return updated;
  },
};
