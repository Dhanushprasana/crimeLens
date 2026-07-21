"use strict";

const env = require("../../../config/env");
const crypto = require("crypto");

// Catalyst datastore expects datetime strings in this exact format:
// yyyy-MM-ddTHH:mm:ss:SSSZ  (colon before ms, numeric offset, no literal "Z")
// Catalyst datastore expects datetime strings in this format:
// yyyy-MM-dd HH:mm:ss:SSS  (space separator, colon before ms, no offset)
function toCatalystDateTime(date) {
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const SSS = pad(date.getMilliseconds(), 3);

  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}:${SSS}`;
}

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
      invite_token_hash: token,
      invited_by: dto.invited_by || null,
      is_account_setup: false,
      is_accepted: false,
      accepted_at: toCatalystDateTime(new Date(0)), // sentinel: not yet accepted
    });
    return { id: saved.ROWID, invite_token: token };
  },

  async getAllInvites(query, req) {
    const sql = `SELECT * FROM sys_user_invite`;
    const res = await executeQuery(req, sql);
    return res.map((r) => r.sys_user_invite);
  },

  async checkInvite(dto, req) {
    const sql = `SELECT * FROM sys_user_invite WHERE invite_token_hash = '${dto.inviteToken}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) throw new Error("Invite not found");
    return res[0].sys_user_invite;
  },

  async acceptInvite(dto, req) {
    const table = getTable(req, "sys_user_invite");
    const rows = await executeQuery(
      req,
      `SELECT * FROM sys_user_invite WHERE invite_token_hash = '${dto.inviteToken}'`,
    );
    if (!rows || rows.length === 0) throw new Error("Invite not found");
    const row = rows[0].sys_user_invite;
    await table.updateRow({
      ROWID: row.ROWID,
      is_accepted: true,
      accepted_at: toCatalystDateTime(new Date()),
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
      invite_token_hash: token,
    });
    return { id: row.ROWID, invite_token: token };
  },

  async getUserInfoById(userInfoId, req) {
    const sql = `SELECT * FROM ${env.TABLE_USER_INFO} WHERE ROWID = '${userInfoId}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) return null;
    return res[0][env.TABLE_USER_INFO];
  },

  async getUserInfoByEmail(email, req) {
    const sql = `SELECT * FROM sys_user_info WHERE email = '${email}'`;
    const res = await executeQuery(req, sql);
    return res && res.length ? res[0].sys_user_info : null;
  },

  async createUserInfo(dto, req) {
    const table = getTable(req, "sys_user_info");
    const fallbackFirstName = dto.email ? dto.email.split("@")[0] : "User";
    const saved = await table.insertRow({
      email: dto.email,
      user_first_name: dto.first_name || fallbackFirstName,
      user_last_name: dto.last_name || null,
      phone: dto.phone || null,
    });
    return { ROWID: saved.ROWID, email: dto.email };
  },

  async getUserByUserInfoId(userInfoId, req) {
    const sql = `SELECT * FROM sys_user WHERE user_info_id = '${userInfoId}'`;
    const res = await executeQuery(req, sql);
    return res && res.length ? res[0].sys_user : null;
  },

  async createUserRecord(userInfoId, req) {
    const table = getTable(req, env.TABLE_USER);
    const saved = await table.insertRow({
      user_info_id: userInfoId,
      is_archived: false,
    });
    return { ROWID: saved.ROWID };
  },
};
