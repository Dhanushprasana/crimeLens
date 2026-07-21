"use strict";

const env = require("../../../config/env");
const crypto = require("crypto");

/**
 * Format a Date as 'YYYY-MM-DD HH:MM:SS' — the format Catalyst datetime columns expect.
 */
function catalystDateTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
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
  /**
   * Look up a role by its name.
   * Returns the role row (including ROWID) or null if not found.
   */
  async getRoleByName(roleName, req) {
    const safe = roleName.replace(/'/g, "''");
    const sql = `SELECT * FROM ${env.TABLE_ROLE} WHERE role_name = '${safe}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) return null;
    return res[0][env.TABLE_ROLE];
  },

  /**
   * Get all available roles (surfaces them in the ROLE_NOT_FOUND error).
   */
  async getAllRoles(req) {
    const sql = `SELECT ROWID, role_name FROM ${env.TABLE_ROLE}`;
    const res = await executeQuery(req, sql);
    return (res || []).map((r) => r[env.TABLE_ROLE]);
  },

  /**
   * Full invite creation flow:
   *
   *  1. sys_user_info  → stores name / email / phone
   *  2. sys_user       → FK to sys_user_info; catalyst_user_id empty until onboarding
   *  3. sys_user_invite→ user_info_id FK points to sys_user.ROWID  ← fixes the error
   *  4. sys_user_role  → user_id FK points to sys_user.ROWID
   *
   * During onboarding (createUserFromInvite) we only need to update
   * sys_user.catalyst_user_id with the real Catalyst auth ID.
   */
  async createInvite(dto, req) {
    // 1. sys_user_info
    const userInfoTable = getTable(req, env.TABLE_USER_INFO);
    const userInfoRow = await userInfoTable.insertRow({
      user_first_name: dto.first_name || "",
      user_last_name: dto.last_name || "",
      email: dto.email,
      phone: dto.phone || null,
    });
    const userInfoId = userInfoRow.ROWID;

    // 2. sys_user  (catalyst_user_id is left empty — filled during onboarding)
    const userTable = getTable(req, env.TABLE_USER);
    const userRow = await userTable.insertRow({
      user_info_id: userInfoId,
      is_archived: false,
    });
    const sysUserId = userRow.ROWID;

    // 3. sys_user_invite  (user_info_id FK → sys_user.ROWID)
    const tokenHash = crypto.randomBytes(32).toString("hex");
    const inviteTable = getTable(req, "sys_user_invite");
    const inviteRow = await inviteTable.insertRow({
      user_info_id: sysUserId,          // FK → sys_user.ROWID  ✔
      invite_token_hash: tokenHash,
      invited_by: dto.invited_by || null,
      accepted_at: catalystDateTime(), // mandatory field; overwritten on actual acceptance
      is_account_setup: false,
      is_accepted: false,
    });

    // 4. sys_user_role
    const userRoleTable = getTable(req, env.TABLE_USER_ROLE);
    await userRoleTable.insertRow({
      user_id: sysUserId,              // FK → sys_user.ROWID  ✔
      role_id: dto.resolvedRoleId,     // resolved from role_name by service layer
    });

    return {
      id: inviteRow.ROWID,
      sys_user_id: sysUserId,
      user_info_id: userInfoId,
      invite_token: tokenHash,
    };
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
      accepted_at: catalystDateTime(),
    });
    // user_info_id here is actually sys_user.ROWID (see createInvite step 3)
    return { message: "Invite accepted", sysUserId: row.user_info_id };
  },

  /**
   * Called during onboarding: updates catalyst_user_id on the existing sys_user row.
   * The sys_user row was already created during invite, so no new insert needed.
   */
  async linkCatalystUser(sysUserId, catalystUserId, req) {
    const table = getTable(req, env.TABLE_USER);
    await table.updateRow({
      ROWID: sysUserId,
      catalyst_user_id: String(catalystUserId),
    });
    return { id: sysUserId };
  },

  /**
   * Fetch invite by email — joins through sys_user → sys_user_info.
   */
  async getLatestInviteByEmail(email, req) {
    const rows = await executeQuery(
      req,
      `SELECT si.* FROM sys_user_invite si
       INNER JOIN ${env.TABLE_USER} su ON si.user_info_id = su.ROWID
       INNER JOIN ${env.TABLE_USER_INFO} sui ON su.user_info_id = sui.ROWID
       WHERE sui.email = '${email}'
       ORDER BY si.CREATEDTIME DESC LIMIT 1`,
    );
    return rows && rows.length ? rows[0].sys_user_invite : null;
  },

  async resendInvite(dto, req) {
    const table = getTable(req, "sys_user_invite");
    const token = crypto.randomBytes(32).toString("hex");
    const rows = await executeQuery(
      req,
      `SELECT si.* FROM sys_user_invite si
       INNER JOIN ${env.TABLE_USER} su ON si.user_info_id = su.ROWID
       INNER JOIN ${env.TABLE_USER_INFO} sui ON su.user_info_id = sui.ROWID
       WHERE sui.email = '${dto.email}'
       ORDER BY si.CREATEDTIME DESC LIMIT 1`,
    );
    if (!rows || rows.length === 0) throw new Error("Invite not found");
    const row = rows[0].sys_user_invite;
    await table.updateRow({
      ROWID: row.ROWID,
      invite_token_hash: token,
    });
    return { id: row.ROWID, invite_token: token };
  },

  /**
   * Returns user_info by sys_user ROWID (used in createUserFromInvite).
   */
  async getUserInfoBySysUserId(sysUserId, req) {
    // sys_user has user_info_id FK → sys_user_info
    const userRows = await executeQuery(
      req,
      `SELECT * FROM ${env.TABLE_USER} WHERE ROWID = '${sysUserId}'`,
    );
    if (!userRows || userRows.length === 0) return null;
    const sysUser = userRows[0][env.TABLE_USER];

    const infoRows = await executeQuery(
      req,
      `SELECT * FROM ${env.TABLE_USER_INFO} WHERE ROWID = '${sysUser.user_info_id}'`,
    );
    if (!infoRows || infoRows.length === 0) return null;
    return infoRows[0][env.TABLE_USER_INFO];
  },

  // Keep old helper for backward compat
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
