"use strict";

const env = require("../../../config/env");
const crypto = require("crypto");

async function executeQuery(req, query) {
  if (!req.catalyst) throw new Error("Catalyst SDK not initialized");
  const zcql = req.catalyst.zcql();
  return zcql.executeZCQLQuery(query);
}

function getTable(req, tableName) {
  if (!req.catalyst) throw new Error("Catalyst SDK not initialized");
  return req.catalyst.datastore().table(tableName);
}

module.exports = {
  async createInvite(dto, req) {
    const table = getTable(req, "sys_user_invite");
    const token = crypto.randomBytes(20).toString("hex");
    const saved = await table.insertRow({
      user_info_id: dto.user_info_id || null,
      invite_token: token,
      invited_by: dto.invited_by || null,
      invite_expiry: dto.invite_expiry || null,
      is_account_set_up: false,
    });
    return { id: saved.ROWID, invite_token: token };
  },

  async getAllInvites(query, req) {
    const sql = `SELECT * FROM sys_user_invite`;
    const res = await executeQuery(req, sql);
    return res.map((r) => r.sys_user_invite);
  },

  async checkInvite(dto, req) {
    const sql = `SELECT * FROM sys_user_invite WHERE invite_token = '${dto.inviteToken}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) throw new Error("Invite not found");
    return res[0].sys_user_invite;
  },

  async acceptInvite(dto, req) {
    // mark accepted
    const table = getTable(req, "sys_user_invite");
    // find by token
    const rows = await executeQuery(
      req,
      `SELECT * FROM sys_user_invite WHERE invite_token = '${dto.inviteToken}'`,
    );
    if (!rows || rows.length === 0) throw new Error("Invite not found");
    const row = rows[0].sys_user_invite;
    await table.updateRow({
      ROWID: row.ROWID,
      is_accepted: true,
      accepted_at: new Date(),
    });
    return { message: "Invite accepted", userInfoId: row.user_info_id };
  },

  async linkCatalystUser(userInfoId, catalystUserId, req) {
    const table = getTable(req, env.TABLE_USER);
    const saved = await table.insertRow({
      user_info_id: userInfoId,
      catalyst_user_id: catalystUserId,
      is_archived: false,
    });
    return { id: saved.ROWID };
  },

  async getLatestInviteByEmail(email, req) {
    const rows = await executeQuery(
      req,
      `SELECT * FROM sys_user_invite WHERE user_info_id IN (SELECT ROWID FROM sys_user_info WHERE email = '${email}') ORDER BY createdtime DESC LIMIT 1`,
    );
    return rows && rows.length ? rows[0].sys_user_invite : null;
  },

  async resendInvite(dto, req) {
    const table = getTable(req, "sys_user_invite");
    const token = crypto.randomBytes(20).toString("hex");
    const rows = await executeQuery(
      req,
      `SELECT * FROM sys_user_invite WHERE user_info_id IN (SELECT ROWID FROM sys_user_info WHERE email = '${dto.email}') ORDER BY createdtime DESC LIMIT 1`,
    );
    if (!rows || rows.length === 0) throw new Error("Invite not found");
    const row = rows[0].sys_user_invite;
    await table.updateRow({
      ROWID: row.ROWID,
      invite_token: token,
      invited_at: new Date(),
    });
    return { id: row.ROWID, invite_token: token };
  },

  async getUserInfoById(userInfoId, req) {
    const sql = `SELECT * FROM ${env.TABLE_USER_INFO} WHERE ROWID = '${userInfoId}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) return null;
    return res[0][env.TABLE_USER_INFO];
  },
};
