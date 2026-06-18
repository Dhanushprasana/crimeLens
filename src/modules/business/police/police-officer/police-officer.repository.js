'use strict';

const env = require('../../../../config/env');
const logger = require('../../../../config/logger');

async function executeQuery(req, query) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  const zcql = req.catalyst.zcql();
  return zcql.executeZCQLQuery(query);
}

function getTable(req, tableName) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  return req.catalyst.datastore().table(tableName);
}

module.exports = {
  async createOfficer(dto, req) {
    const email = dto.email.trim().toLowerCase();
    const badge = dto.badge_number;

    // Check if officer with same badge exists
    const checkQuery = `SELECT * FROM ${env.TABLE_POLICE_OFFICER} WHERE badge_number = '${badge}'`;
    const checkRes = await executeQuery(req, checkQuery);
    if (checkRes && checkRes.length > 0) throw new Error('Officer with this badge already exists');

    // Ensure sys_user_info
    const userInfoTable = getTable(req, env.TABLE_USER_INFO);
    let userInfoId = null;
    const infoQuery = `SELECT * FROM ${env.TABLE_USER_INFO} WHERE email = '${email}'`;
    const infoRes = await executeQuery(req, infoQuery);
    if (infoRes && infoRes.length > 0) {
      userInfoId = infoRes[0][env.TABLE_USER_INFO].ROWID;
    } else {
      const nameParts = (dto.name || '').trim().split(' ');
      const first = nameParts[0] || '';
      const last = nameParts.slice(1).join(' ') || '';
      const savedInfo = await userInfoTable.insertRow({
        user_first_name: first,
        user_last_name: last,
        email: email,
        phone: dto.contact_number || null
      });
      userInfoId = savedInfo.ROWID;
    }

    // Ensure sys_user
    const userTable = getTable(req, env.TABLE_USER);
    const userQuery = `SELECT * FROM ${env.TABLE_USER} WHERE user_info_id = '${userInfoId}'`;
    const userRes = await executeQuery(req, userQuery);
    let userId = null;
    if (userRes && userRes.length > 0) {
      userId = userRes[0][env.TABLE_USER].ROWID;
    } else {
      const savedUser = await userTable.insertRow({
        user_info_id: userInfoId,
        is_archived: false
      });
      userId = savedUser.ROWID;

      // Assign default role
      const roleName = env.DEFAULT_OFFICER_ROLE;
      const roleQuery = `SELECT * FROM ${env.TABLE_ROLE} WHERE role_name = '${roleName}'`;
      const roleRes = await executeQuery(req, roleQuery);
      if (roleRes && roleRes.length > 0) {
        const roleId = roleRes[0][env.TABLE_ROLE].ROWID;
        const urTable = getTable(req, env.TABLE_USER_ROLE);
        await urTable.insertRow({ user_id: userId, role_id: roleId });
      }
    }

    // Insert officer record
    const officerTable = getTable(req, env.TABLE_POLICE_OFFICER);
    const officerRow = {
      user_id: userId,
      badge_number: badge,
      rank_id: dto.rank_id || null,
      station_id: dto.station_id || null,
      date_of_joining: dto.date_of_joining || null,
      operational_status: dto.operational_status || 'ACTIVE',
      contact_number: dto.contact_number || null
    };
    const savedOfficer = await officerTable.insertRow(officerRow);

    return { id: savedOfficer.ROWID, badge_number: badge };
  },

  async getAllOfficers(query, req) {
    const sql = `SELECT * FROM ${env.TABLE_POLICE_OFFICER}`;
    const res = await executeQuery(req, sql);
    return res.map(r => r[env.TABLE_POLICE_OFFICER]);
  },

  async getOneOfficer(id, req) {
    const sql = `SELECT * FROM ${env.TABLE_POLICE_OFFICER} WHERE ROWID = '${id}'`;
    const res = await executeQuery(req, sql);
    if (!res || res.length === 0) throw new Error('Officer not found');
    return res[0][env.TABLE_POLICE_OFFICER];
  },

  async updateOfficer(id, dto, req) {
    const table = getTable(req, env.TABLE_POLICE_OFFICER);
    const updateObj = Object.assign({ ROWID: id }, dto);
    await table.updateRow(updateObj);
    return { message: 'Officer updated' };
  },

  async softDeleteOfficer(id, req) {
    const table = getTable(req, env.TABLE_POLICE_OFFICER);
    await table.updateRow({ ROWID: id, is_archived: true });
    return { message: 'Officer soft-deleted' };
  },

  // Rank operations
  async createRank(dto, req) {
    const table = getTable(req, env.TABLE_POLICE_RANK);
    const saved = await table.insertRow({ rank_name: dto.rank_name, hierarchy_level: dto.hierarchy_level || null });
    return { id: saved.ROWID, rank_name: dto.rank_name };
  },

  async getAllRanks(query, req) {
    const sql = `SELECT * FROM ${env.TABLE_POLICE_RANK}`;
    const res = await executeQuery(req, sql);
    return res.map(r => r[env.TABLE_POLICE_RANK]);
  },

  async deleteRank(id, req) {
    const table = getTable(req, env.TABLE_POLICE_RANK);
    await table.deleteRow(id);
    return { message: 'Rank deleted' };
  }
};
