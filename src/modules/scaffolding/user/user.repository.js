"use strict";

const env = require("../../../config/env");
const logger = require("../../../config/logger");
const bcrypt = require("bcrypt");
const catalystAuth = require("../../../catalyst/auth/auth");

const SUPER_ADMIN_ROLE = "SUPER_ADMIN";

// Helper to query Catalyst ZCQL
async function executeQuery(req, query) {
  if (!req.catalyst) {
    throw new Error("Catalyst SDK is not initialized in request");
  }
  const zcql = req.catalyst.zcql();
  return await zcql.executeZCQLQuery(query);
}

// Helper to get Catalyst Table
function getTable(req, tableName) {
  if (!req.catalyst) {
    throw new Error("Catalyst SDK is not initialized in request");
  }
  return req.catalyst.datastore().table(tableName);
}

module.exports = {
  async createUser(dto, req) {
    const email = dto.email.trim().toLowerCase();

    // Split full name into first and last name components
    const nameParts = (dto.name || "").trim().split(" ");
    const userFirstName = nameParts[0] || "";
    const userLastName = nameParts.slice(1).join(" ") || "";

    // 1. Check if user already exists in sys_user_info
    const checkQuery = `SELECT * FROM ${env.TABLE_USER_INFO} WHERE email = '${email}'`;
    const checkResult = await executeQuery(req, checkQuery);
    if (checkResult && checkResult.length > 0) {
      throw new Error("User already exists");
    }

    // 2. Resolve provided roles (from `roleNames` array) — can be ROWIDs or role names — to canonical ROWIDs
    const providedRoles = dto.roleNames || [];
    const roleIds = [];
    const roleDetails = [];

    for (const r of providedRoles) {
      let roleResult = null;
      // If r looks like a numeric ROWID, query by ROWID without quotes to avoid cast errors
      if (/^-?\d+$/.test(String(r))) {
        const roleQuery = `SELECT * FROM ${env.TABLE_ROLE} WHERE ROWID = ${r}`;
        roleResult = await executeQuery(req, roleQuery);
      }

      if (!roleResult || roleResult.length === 0) {
        // Try by role name
        const roleQueryByName = `SELECT * FROM ${env.TABLE_ROLE} WHERE role_name = '${r}'`;
        roleResult = await executeQuery(req, roleQueryByName);
      }

      if (!roleResult || roleResult.length === 0) {
        throw new Error(`Role '${r}' not found`);
      }

      const role = roleResult[0][env.TABLE_ROLE];
      roleIds.push(role.ROWID);
      roleDetails.push({ id: role.ROWID, name: role.role_name });
    }

    // 3. Ensure user exists in Catalyst Auth — create if catalystUserId not provided
    let catalystUserId = dto.catalystUserId || null;
    if (!catalystUserId) {
      try {
        const created = await catalystAuth.createUser(
          req,
          email,
          dto.password,
          userFirstName,
        );

        // Try common response shapes to extract an id. SDK returns { user_details: ICatalystUser }
        catalystUserId =
          created?.user_details?.user_id ||
          created?.user_details?.zuid ||
          created?.user_id ||
          created?.id ||
          created?.USER_ID ||
          created?.user?.id ||
          created?.user?.user_id ||
          null;
        logger.info(`Catalyst user created or returned id: ${catalystUserId}`);
      } catch (err) {
        logger.error("Failed to create or fetch Catalyst auth user", err);
        throw err;
      }
    }

    // 4. Save profile metadata first in sys_user_info table (to retrieve its ROWID for foreign key user_info_id)
    const userInfoTable = getTable(req, env.TABLE_USER_INFO);
    const savedInfo = await userInfoTable.insertRow({
      user_first_name: userFirstName,
      user_last_name: userLastName,
      email: email,
      phone: dto.phone || null,
    });

    // 5. Save account credential configurations in sys_user table (associated to user_info_id)
    const userTable = getTable(req, env.TABLE_USER);
    const savedUser = await userTable.insertRow({
      user_info_id: savedInfo.ROWID,
      is_archived: false,
      catalyst_user_id: catalystUserId || null,
    });

    // 6. Map Roles in sys_user_role table
    const userRoleTable = getTable(req, env.TABLE_USER_ROLE);
    for (const roleId of roleIds) {
      await userRoleTable.insertRow({
        user_id: savedUser.ROWID,
        role_id: roleId,
      });
    }

    return {
      id: savedUser.ROWID,
      isArchived: savedUser.is_archived,
      userInfo: {
        id: savedInfo.ROWID,
        name: `${savedInfo.user_first_name} ${savedInfo.user_last_name}`.trim(),
        email: savedInfo.email,
        phone: savedInfo.phone,
        roleDetails,
      },
    };
  },

  async getAllUsers(query, req) {
    const { page, limit, status } = query;

    // ZCQL enforces a hard cap of 300 rows per query.
    // We use a safe batch size of 200 and loop until no more rows are returned.
    const ZCQL_BATCH_SIZE = 200;

    const baseConditions = [];
    if (status !== "GET_ALL") {
      baseConditions.push(`is_archived = false`);
    }

    const baseTable = env.TABLE_USER || "sys_user";
    const whereClause =
      baseConditions.length > 0
        ? ` WHERE ${baseConditions.join(" AND ")}`
        : "";

    // Fetch ALL rows in batches to bypass the ZCQL 300-row cap
    const allUsersResult = [];
    let batchOffset = 0;
    while (true) {
      const batchSql = `SELECT * FROM ${baseTable}${whereClause} LIMIT ${ZCQL_BATCH_SIZE} OFFSET ${batchOffset}`;
      const batchResult = await executeQuery(req, batchSql);
      if (!batchResult || batchResult.length === 0) break;
      allUsersResult.push(...batchResult);
      if (batchResult.length < ZCQL_BATCH_SIZE) break; // Last page
      batchOffset += ZCQL_BATCH_SIZE;
    }

    const total = allUsersResult.length;

    // Apply pagination in JavaScript — never pass a large LIMIT to ZCQL
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 0;
    const offset = (parsedPage - 1) * parsedLimit;

    const usersSubset =
      parsedLimit > 0
        ? allUsersResult.slice(offset, offset + parsedLimit)
        : allUsersResult;

    const result = [];
    for (const row of usersSubset) {
      const user = row[env.TABLE_USER];

      // Fetch UserInfo matching user_info_id
      let userInfo = {};
      if (user.user_info_id) {
        const infoQuery = `SELECT * FROM ${env.TABLE_USER_INFO} WHERE ROWID = '${user.user_info_id}'`;
        const infoResult = await executeQuery(req, infoQuery);
        if (infoResult && infoResult.length > 0) {
          userInfo = infoResult[0][env.TABLE_USER_INFO];
        }
      }

      // Fetch UserRoles mapped to user_id
      const urQuery = `SELECT * FROM ${env.TABLE_USER_ROLE} WHERE user_id = '${user.ROWID}'`;
      const urResult = await executeQuery(req, urQuery);
      const roleIds = urResult.map((item) => item[env.TABLE_USER_ROLE].role_id);

      let roles = [];
      if (roleIds.length > 0) {
        const roleQuery = `SELECT * FROM ${env.TABLE_ROLE} WHERE ROWID IN (${roleIds.map((id) => `'${id}'`).join(",")})`;
        const roleResult = await executeQuery(req, roleQuery);
        roles = roleResult.map((r) => ({
          id: r[env.TABLE_ROLE].ROWID,
          name: r[env.TABLE_ROLE].role_name,
        }));
      }

      result.push({
        id: user.ROWID,
        isArchived: user.is_archived ?? false,
        userInfo: {
          id: userInfo.ROWID,
          name: `${userInfo.user_first_name || ""} ${userInfo.user_last_name || ""}`.trim(),
          email: userInfo.email,
          phone: userInfo.phone,
        },
        roles,
      });
    }

    return parsedLimit > 0 ? { users: result, total } : result;
  },

  async restoreUser(id, req) {
    // sys_user schema does not contain soft delete metadata column (like deletedAt).
    // So restore is a no-op/unsupported action on this table.
    throw new Error(
      "Restore not supported: sys_user table does not support soft-deletion columns.",
    );
  },

  async getAllUsersV2(query, req) {
    const usersList = await this.getAllUsers(query, req);
    const enrichedUsers = Array.isArray(usersList)
      ? usersList
      : usersList.users;

    const flattened_users = enrichedUsers.map((user) => ({
      id: user.id,
      userInfo: {
        name: user.userInfo.name,
        email: user.userInfo.email,
        phone: user.userInfo.phone,
        roles: user.roles,
      },
      isArchived: user.isArchived,
      type: "USER",
    }));

    return query.limit && query.page
      ? {
          flattened_users,
          total: flattened_users.length,
          userCount: {
            totalUsers: flattened_users.length,
            totalInvites: 0,
            totalRequests: 0,
          },
        }
      : flattened_users;
  },

  async updateUserRoleByEmail(dto, req) {
    const { email, roleName } = dto;
    const cleanEmail = email.trim().toLowerCase();

    // 1. Fetch target role by name
    const roleQuery = `SELECT * FROM ${env.TABLE_ROLE} WHERE role_name = '${roleName}'`;
    const roleResult = await executeQuery(req, roleQuery);
    if (!roleResult || roleResult.length === 0) {
      throw new Error(`Role '${roleName}' not found`);
    }
    const role = roleResult[0][env.TABLE_ROLE];

    // 2. Fetch UserInfo by email
    const infoQuery = `SELECT * FROM ${env.TABLE_USER_INFO} WHERE email = '${cleanEmail}'`;
    const infoResult = await executeQuery(req, infoQuery);
    if (!infoResult || infoResult.length === 0) {
      throw new Error(`User with email ${email} not found`);
    }
    const userInfo = infoResult[0][env.TABLE_USER_INFO];

    // 3. Find User record by user_info_id
    const userQuery = `SELECT ROWID FROM ${env.TABLE_USER} WHERE user_info_id = '${userInfo.ROWID}'`;
    const userResult = await executeQuery(req, userQuery);
    if (!userResult || userResult.length === 0) {
      throw new Error("User not found");
    }
    const userId = userResult[0][env.TABLE_USER].ROWID;

    // 4. Clear existing role mappings for user in UserRole
    const urTable = getTable(req, env.TABLE_USER_ROLE);
    const urQuery = `SELECT ROWID FROM ${env.TABLE_USER_ROLE} WHERE user_id = '${userId}'`;
    const urResult = await executeQuery(req, urQuery);
    for (const rowObj of urResult) {
      await urTable.deleteRow(rowObj[env.TABLE_USER_ROLE].ROWID);
    }

    // 5. Map new role in UserRole
    await urTable.insertRow({
      user_id: userId,
      role_id: role.ROWID,
    });

    return { message: `Role '${roleName}' replaced for ${email}` };
  },

  async deactivateUser(email, req) {
    const cleanEmail = email.trim().toLowerCase();

    // Fetch UserInfo by email
    const infoQuery = `SELECT * FROM ${env.TABLE_USER_INFO} WHERE email = '${cleanEmail}'`;
    const infoResult = await executeQuery(req, infoQuery);
    if (!infoResult || infoResult.length === 0) {
      throw new Error("User not found");
    }
    const userInfo = infoResult[0][env.TABLE_USER_INFO];

    // Fetch User entity using user_info_id
    const userQuery = `SELECT * FROM ${env.TABLE_USER} WHERE user_info_id = '${userInfo.ROWID}'`;
    const userResult = await executeQuery(req, userQuery);
    if (!userResult || userResult.length === 0) {
      throw new Error("User not found");
    }

    const user = userResult[0][env.TABLE_USER];
    if (user.is_archived === true || user.is_archived === "true") {
      throw new Error("User already deactivated");
    }

    // Ensure we do not deactivate the last active SUPER_ADMIN
    const urQuery = `SELECT * FROM ${env.TABLE_USER_ROLE} WHERE user_id = '${user.ROWID}'`;
    const urResult = await executeQuery(req, urQuery);
    const roleIds = urResult.map((item) => item[env.TABLE_USER_ROLE].role_id);

    let isSuperAdmin = false;
    if (roleIds.length > 0) {
      const roleQuery = `SELECT * FROM ${env.TABLE_ROLE} WHERE ROWID IN (${roleIds.map((id) => `'${id}'`).join(",")})`;
      const roleResult = await executeQuery(req, roleQuery);
      isSuperAdmin = roleResult.some(
        (r) => r[env.TABLE_ROLE].role_name === SUPER_ADMIN_ROLE,
      );
    }

    if (isSuperAdmin) {
      const activeAdminQuery = `SELECT * FROM ${env.TABLE_ROLE} WHERE role_name = '${SUPER_ADMIN_ROLE}'`;
      const activeAdminResult = await executeQuery(req, activeAdminQuery);
      if (activeAdminResult && activeAdminResult.length > 0) {
        const adminRoleId = activeAdminResult[0][env.TABLE_ROLE].ROWID;
        const totalAdminsQuery = `SELECT * FROM ${env.TABLE_USER_ROLE} WHERE role_id = '${adminRoleId}'`;
        const totalAdminsResult = await executeQuery(req, totalAdminsQuery);
        if (totalAdminsResult.length <= 1) {
          throw new Error(
            "Cannot deactivate this user. At least one superadmin must remain active.",
          );
        }
      }
    }

    // Deactivate user
    const userTable = getTable(req, env.TABLE_USER);
    await userTable.updateRow({
      ROWID: user.ROWID,
      is_archived: true,
    });

    return { message: "User deactivation successful" };
  },

  async activateUser(email, req) {
    const cleanEmail = email.trim().toLowerCase();

    const infoQuery = `SELECT * FROM ${env.TABLE_USER_INFO} WHERE email = '${cleanEmail}'`;
    const infoResult = await executeQuery(req, infoQuery);
    if (!infoResult || infoResult.length === 0) {
      throw new Error("User not found");
    }
    const userInfo = infoResult[0][env.TABLE_USER_INFO];

    const userQuery = `SELECT * FROM ${env.TABLE_USER} WHERE user_info_id = '${userInfo.ROWID}'`;
    const userResult = await executeQuery(req, userQuery);
    if (!userResult || userResult.length === 0) {
      throw new Error("User not found");
    }

    const user = userResult[0][env.TABLE_USER];
    if (
      user.is_archived === false ||
      user.is_archived === "false" ||
      user.is_archived === null
    ) {
      throw new Error("User already activated");
    }

    const userTable = getTable(req, env.TABLE_USER);
    await userTable.updateRow({
      ROWID: user.ROWID,
      is_archived: false,
    });

    return { message: "User activation successful" };
  },

  async hardDeleteUser(emails, req) {
    const cleanEmails = emails.map((email) => email.trim().toLowerCase());
    const matchedUserIds = [];
    const matchedUserInfoIds = [];

    // Find UserInfo objects
    const formattedEmails = cleanEmails.map((e) => `'${e}'`).join(",");
    const infoQuery = `SELECT * FROM ${env.TABLE_USER_INFO} WHERE email IN (${formattedEmails})`;
    const infoResult = await executeQuery(req, infoQuery);

    for (const rowObj of infoResult) {
      const info = rowObj[env.TABLE_USER_INFO];
      matchedUserInfoIds.push(info.ROWID);

      // Find matching user ID
      const userQuery = `SELECT ROWID FROM ${env.TABLE_USER} WHERE user_info_id = '${info.ROWID}'`;
      const userResult = await executeQuery(req, userQuery);
      if (userResult && userResult.length > 0) {
        matchedUserIds.push(userResult[0][env.TABLE_USER].ROWID);
      }
    }

    if (matchedUserInfoIds.length === 0) {
      return { message: "No users found matching the provided emails." };
    }

    // 1. Delete user role mappings in UserRole
    const urTable = getTable(req, env.TABLE_USER_ROLE);
    for (const userId of matchedUserIds) {
      const urQuery = `SELECT ROWID FROM ${env.TABLE_USER_ROLE} WHERE user_id = '${userId}'`;
      const urResult = await executeQuery(req, urQuery);
      for (const rowObj of urResult) {
        await urTable.deleteRow(rowObj[env.TABLE_USER_ROLE].ROWID);
      }
    }

    // 2. Delete root User records
    const userTable = getTable(req, env.TABLE_USER);
    for (const userId of matchedUserIds) {
      await userTable.deleteRow(userId);
    }

    // 3. Delete UserInfo records
    const userInfoTable = getTable(req, env.TABLE_USER_INFO);
    for (const infoId of matchedUserInfoIds) {
      await userInfoTable.deleteRow(infoId);
    }

    return {
      message: `Successfully hard-deleted ${matchedUserInfoIds.length} users`,
      deletedCount: {
        users: matchedUserInfoIds.length,
      },
    };
  },
};
