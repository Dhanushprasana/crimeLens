'use strict';

const env = require('../../../config/env');
const logger = require('../../../config/logger');

// Non-editable system default roles
const NON_EDITABLE_ROLES = ['SUPER_ADMIN'];
const DEFAULT_ROLE = 'CONTRIBUTOR';

// Helper to query Catalyst ZCQL
async function executeQuery(req, query) {
  if (!req.catalyst) {
    throw new Error('Catalyst SDK is not initialized in request');
  }
  const zcql = req.catalyst.zcql();
  return await zcql.executeZCQLQuery(query);
}

// Helper to get Catalyst Table
function getTable(req, tableName) {
  if (!req.catalyst) {
    throw new Error('Catalyst SDK is not initialized in request');
  }
  return req.catalyst.datastore().table(tableName);
}

// Recursively flattens permissions tree structure
function flattenPermissionsTree(nodes, parentMap, parentName = null) {
  let names = [];
  for (const node of nodes) {
    names.push(node.name);
    if (parentName) {
      if (!parentMap.has(node.name)) {
        parentMap.set(node.name, []);
      }
      parentMap.get(node.name).push(parentName);
    }
    if (node.children && node.children.length > 0) {
      const childNames = flattenPermissionsTree(node.children, parentMap, node.name);
      names.push(...childNames);
    }
  }
  return names;
}

module.exports = {
  async createRole(dto, req) {
    const table = getTable(req, env.TABLE_ROLE);
    const name = dto.name.trim();

    // Check if role name already exists
    const checkQuery = `SELECT * FROM ${env.TABLE_ROLE} WHERE role_name = '${name}'`;
    const checkResult = await executeQuery(req, checkQuery);
    if (checkResult && checkResult.length > 0) {
      throw new Error(`Role ${name} already exists`);
    }

    const newRole = {
      role_name: name,
      is_default: dto.isDefault || false,
      description: dto.description || ''
    };

    const saved = await table.insertRow(newRole);
    return {
      id: saved.ROWID,
      name: saved.role_name,
      isDefault: saved.is_default,
      description: saved.description
    };
  },

  async findAllRoles(query, req) {
    const { page, limit, search, isDetailed } = query;

    let sql = `SELECT * FROM ${env.TABLE_ROLE}`;
    const conditions = [];

    if (search) {
      conditions.push(`role_name LIKE '%${search}%'`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY role_name ASC`;

    // Implement pagination limit & offset if provided
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 0;
    const offset = (parsedPage - 1) * parsedLimit;

    const allRolesResult = await executeQuery(req, sql);
    const total = allRolesResult.length;

    let rolesSubset = allRolesResult;
    if (parsedLimit > 0) {
      sql += ` LIMIT ${parsedLimit} OFFSET ${offset}`;
      rolesSubset = await executeQuery(req, sql);
    }

    const mappedRoles = rolesSubset.map(r => r[env.TABLE_ROLE]);
    const isDetailedBool = String(isDetailed).toLowerCase() === 'true';

    const enrichedRoles = [];
    for (const role of mappedRoles) {
      const isEditable = !NON_EDITABLE_ROLES.includes(role.role_name);

      if (!isDetailedBool) {
        enrichedRoles.push({
          id: role.ROWID,
          name: role.role_name,
          isDefault: role.is_default ?? false,
          description: role.description,
          isEditable,
          createdAt: role.CREATEDTIME,
          updatedAt: role.MODIFIEDTIME
        });
      } else {
        // Fetch mapped permissions for this role from sys_role_permission
        const rpQuery = `SELECT * FROM ${env.TABLE_ROLE_PERMISSION} WHERE role_id = '${role.ROWID}'`;
        const rpResult = await executeQuery(req, rpQuery);
        const permIds = rpResult.map(item => item[env.TABLE_ROLE_PERMISSION].permission_id);

        let systemPermissions = [];
        if (permIds.length > 0) {
          const permQuery = `SELECT * FROM ${env.TABLE_PERMISSION} WHERE ROWID IN (${permIds.map(id => `'${id}'`).join(',')})`;
          const permResult = await executeQuery(req, permQuery);
          systemPermissions = permResult.map(p => ({
            id: p[env.TABLE_PERMISSION].ROWID,
            name: p[env.TABLE_PERMISSION].permission_name,
            description: p[env.TABLE_PERMISSION].description,
            enabled: true,
            createdAt: p[env.TABLE_PERMISSION].CREATEDTIME,
            updatedAt: p[env.TABLE_PERMISSION].MODIFIEDTIME
          }));
        }

        // Fetch mapped business permissions
        let bizRoots = [];
        try {
          const brpQuery = `SELECT * FROM ${env.TABLE_BIZ_ROLE_PERMISSION} WHERE role_id = '${role.ROWID}'`;
          const brpResult = await executeQuery(req, brpQuery);
          const bizPermIds = brpResult.map(item => item[env.TABLE_BIZ_ROLE_PERMISSION].permission_id);

          if (bizPermIds.length > 0) {
            const bizPermQuery = `SELECT * FROM ${env.TABLE_BIZ_PERMISSION} WHERE ROWID IN (${bizPermIds.map(id => `'${id}'`).join(',')})`;
            const bizPermResult = await executeQuery(req, bizPermQuery);
            
            const bizNodes = bizPermResult.map(p => ({
              id: p[env.TABLE_BIZ_PERMISSION].ROWID,
              name: p[env.TABLE_BIZ_PERMISSION].permission_name,
              description: p[env.TABLE_BIZ_PERMISSION].description,
              parentId: p[env.TABLE_BIZ_PERMISSION].parent_id || null,
              enabled: p[env.TABLE_BIZ_PERMISSION].is_enabled ?? true,
              createdAt: p[env.TABLE_BIZ_PERMISSION].CREATEDTIME,
              updatedAt: p[env.TABLE_BIZ_PERMISSION].MODIFIEDTIME,
              children: []
            }));
            
            const idToBiz = new Map();
            bizNodes.forEach(node => idToBiz.set(node.id, node));
            
            bizNodes.forEach(node => {
              if (node.parentId && idToBiz.has(node.parentId)) {
                idToBiz.get(node.parentId).children.push(node);
              } else {
                bizRoots.push(node);
              }
            });
          }
        } catch (e) {
          logger.warn('Could not fetch business permissions for role ' + role.ROWID);
        }

        // Fetch users mapped to this role from UserRole join table
        const urQuery = `SELECT * FROM ${env.TABLE_USER_ROLE} WHERE role_id = '${role.ROWID}'`;
        const urResult = await executeQuery(req, urQuery);
        const userIds = urResult.map(item => item[env.TABLE_USER_ROLE].user_id);

        let users = [];
        if (userIds.length > 0) {
          // First fetch sys_user rows to get user_info_id and archived flag
          const userRows = await executeQuery(req, `SELECT ROWID, user_info_id, isArchived FROM ${env.TABLE_USER} WHERE ROWID IN (${userIds.map(id => `'${id}'`).join(',')})`);
          const userInfoIds = [];
          const userMap = {};
          userRows.forEach(r => {
            const row = r[env.TABLE_USER];
            userMap[row.ROWID] = { isArchived: row.isArchived ?? false, userInfoId: row.user_info_id };
            if (row.user_info_id) userInfoIds.push(row.user_info_id);
          });

          // Fetch sys_user_info for those IDs
          const userInfoMap = {};
          if (userInfoIds.length > 0) {
            const infoRows = await executeQuery(req, `SELECT ROWID, email, first_name, last_name FROM ${env.TABLE_USER_INFO} WHERE ROWID IN (${userInfoIds.map(id => `'${id}'`).join(',')})`);
            infoRows.forEach(r => {
              const info = r[env.TABLE_USER_INFO];
              userInfoMap[info.ROWID] = info;
            });
          }

          // Assemble enriched users array
          users = Object.entries(userMap).map(([userId, meta]) => {
            const info = userInfoMap[meta.userInfoId] || {};
            return {
              id: userId,
              email: info.email || null,
              name: (info.first_name || info.last_name) ? `${info.first_name || ''} ${info.last_name || ''}`.trim() : null,
              isArchived: meta.isArchived
            };
          });
        }

        enrichedRoles.push({
          id: role.ROWID,
          name: role.role_name,
          isDefault: role.is_default ?? false,
          description: role.description,
          isEditable,
          createdAt: role.CREATEDTIME,
          updatedAt: role.MODIFIEDTIME,
          systemPermissions,
          businessPermissions: bizRoots,
          users
        });
      }
    }

    return { roles: enrichedRoles, total };
  },

  async findRoleById(id, req) {
    const query = `SELECT * FROM ${env.TABLE_ROLE} WHERE ROWID = '${id}'`;
    const result = await executeQuery(req, query);
    if (!result || result.length === 0) {
      throw new Error(`Role with ID ${id} not found`);
    }

    const role = result[0][env.TABLE_ROLE];

    // Fetch associated system permissions
    const rpQuery = `SELECT * FROM ${env.TABLE_ROLE_PERMISSION} WHERE role_id = '${role.ROWID}'`;
    const rpResult = await executeQuery(req, rpQuery);
    const permIds = rpResult.map(item => item[env.TABLE_ROLE_PERMISSION].permission_id);

    let systemPermissions = [];
    if (permIds.length > 0) {
      const permQuery = `SELECT * FROM ${env.TABLE_PERMISSION} WHERE ROWID IN (${permIds.map(pId => `'${pId}'`).join(',')})`;
      const permResult = await executeQuery(req, permQuery);
      systemPermissions = permResult.map(p => ({
        id: p[env.TABLE_PERMISSION].ROWID,
        name: p[env.TABLE_PERMISSION].permission_name,
        description: p[env.TABLE_PERMISSION].description,
        enabled: true,
        createdAt: p[env.TABLE_PERMISSION].CREATEDTIME,
        updatedAt: p[env.TABLE_PERMISSION].MODIFIEDTIME
      }));
    }

    // Fetch associated business permissions
    let businessPermissions = [];
    try {
      const brpQuery = `SELECT * FROM ${env.TABLE_BIZ_ROLE_PERMISSION} WHERE role_id = '${role.ROWID}'`;
      const brpResult = await executeQuery(req, brpQuery);
      const bizPermIds = brpResult.map(item => item[env.TABLE_BIZ_ROLE_PERMISSION].permission_id);

      if (bizPermIds.length > 0) {
        const bizPermQuery = `SELECT * FROM ${env.TABLE_BIZ_PERMISSION} WHERE ROWID IN (${bizPermIds.map(id => `'${id}'`).join(',')})`;
        const bizPermResult = await executeQuery(req, bizPermQuery);
        
        const bizNodes = bizPermResult.map(p => ({
          id: p[env.TABLE_BIZ_PERMISSION].ROWID,
          name: p[env.TABLE_BIZ_PERMISSION].permission_name,
          description: p[env.TABLE_BIZ_PERMISSION].description,
          parentId: p[env.TABLE_BIZ_PERMISSION].parent_id || null,
          enabled: p[env.TABLE_BIZ_PERMISSION].is_enabled ?? true,
          createdAt: p[env.TABLE_BIZ_PERMISSION].CREATEDTIME,
          updatedAt: p[env.TABLE_BIZ_PERMISSION].MODIFIEDTIME,
          children: []
        }));
        
        const idToBiz = new Map();
        bizNodes.forEach(node => idToBiz.set(node.id, node));
        
        bizNodes.forEach(node => {
          if (node.parentId && idToBiz.has(node.parentId)) {
            idToBiz.get(node.parentId).children.push(node);
          } else {
            businessPermissions.push(node);
          }
        });
      }
    } catch (e) {
      logger.warn('Could not fetch business permissions for role ' + role.ROWID);
    }

    return {
      id: role.ROWID,
      name: role.role_name,
      isDefault: role.is_default ?? false,
      description: role.description,
      systemPermissions,
      businessPermissions
    };
  },

  async updateRoleAndPermissions(id, dto, req) {
    const table = getTable(req, env.TABLE_ROLE);

    // Get current role
    const checkQuery = `SELECT * FROM ${env.TABLE_ROLE} WHERE ROWID = '${id}'`;
    const checkResult = await executeQuery(req, checkQuery);
    if (!checkResult || checkResult.length === 0) {
      throw new Error(`Role with ID ${id} not found`);
    }

    const role = checkResult[0][env.TABLE_ROLE];
    if (NON_EDITABLE_ROLES.includes(role.role_name)) {
      throw new Error(`${role.role_name} role cannot be updated.`);
    }

    // Update role name and description
    let updated = false;
    const updatePayload = { ROWID: id };

    if (dto.name && dto.name.trim() !== role.role_name) {
      const newName = dto.name.trim();

      const dupQuery = `SELECT * FROM ${env.TABLE_ROLE} WHERE role_name = '${newName}' AND ROWID != '${id}'`;
      const dupResult = await executeQuery(req, dupQuery);
      if (dupResult && dupResult.length > 0) {
        throw new Error(`Role name ${newName} already exists`);
      }

      updatePayload.role_name = newName;
      updated = true;
    }

    if (dto.description !== undefined && dto.description !== role.description) {
      updatePayload.description = dto.description;
      updated = true;
    }

    if (updated) {
      await table.updateRow(updatePayload);
    }

    // Update mapped permissions if provided in DTO
    if (dto.permission && Array.isArray(dto.permission)) {
      const parentMap = new Map();
      const permissionNames = flattenPermissionsTree(dto.permission, parentMap);

      if (permissionNames.length === 0) {
        throw new Error('A role must have at least one permission assigned');
      }

      await this.mapPermissionsToRole(id, permissionNames, req);
    }

    return { message: 'Role updated successfully' };
  },

  async softDeleteRole(roleId, req) {
    // sys_role schema does not contain soft delete metadata column (like deletedAt).
    // So we will perform a hard delete directly.
    logger.warn(`Soft delete requested for Role ID ${roleId}. Reassigning users and hard-deleting due to schema limits.`);

    // Check if role exists
    const checkQuery = `SELECT * FROM ${env.TABLE_ROLE} WHERE ROWID = '${roleId}'`;
    const checkResult = await executeQuery(req, checkQuery);
    if (!checkResult || checkResult.length === 0) {
      throw new Error(`Role with ID ${roleId} not found`);
    }

    const role = checkResult[0][env.TABLE_ROLE];
    if (role.role_name === DEFAULT_ROLE || NON_EDITABLE_ROLES.includes(role.role_name)) {
      throw new Error(`Cannot delete the default/protected ${role.role_name} role`);
    }

    // Find fallback role (CONTRIBUTOR)
    const fallbackQuery = `SELECT * FROM ${env.TABLE_ROLE} WHERE role_name = '${DEFAULT_ROLE}'`;
    const fallbackResult = await executeQuery(req, fallbackQuery);
    if (!fallbackResult || fallbackResult.length === 0) {
      throw new Error(`Fallback ${DEFAULT_ROLE} role not found`);
    }
    const fallbackRole = fallbackResult[0][env.TABLE_ROLE];

    // Reassign mapped users to fallback role
    const urTable = getTable(req, env.TABLE_USER_ROLE);
    const urQuery = `SELECT * FROM ${env.TABLE_USER_ROLE} WHERE role_id = '${roleId}'`;
    const urResult = await executeQuery(req, urQuery);
    for (const rowObj of urResult) {
      const userRoleRow = rowObj[env.TABLE_USER_ROLE];
      await urTable.updateRow({
        ROWID: userRoleRow.ROWID,
        role_id: fallbackRole.ROWID
      });
    }

    // Since sys_role_permission has foreign key role_id, clear role mappings from sys_role_permission first
    const rpTable = getTable(req, env.TABLE_ROLE_PERMISSION);
    const rpQuery = `SELECT ROWID FROM ${env.TABLE_ROLE_PERMISSION} WHERE role_id = '${roleId}'`;
    const rpResult = await executeQuery(req, rpQuery);
    for (const rowObj of rpResult) {
      await rpTable.deleteRow(rowObj[env.TABLE_ROLE_PERMISSION].ROWID);
    }

    // Also clear mappings from biz_role_permission
    try {
      const brpTable = getTable(req, env.TABLE_BIZ_ROLE_PERMISSION);
      const brpQuery = `SELECT ROWID FROM ${env.TABLE_BIZ_ROLE_PERMISSION} WHERE role_id = '${roleId}'`;
      const brpResult = await executeQuery(req, brpQuery);
      for (const rowObj of brpResult) {
        await brpTable.deleteRow(rowObj[env.TABLE_BIZ_ROLE_PERMISSION].ROWID);
      }
    } catch (e) {
      logger.warn('Failed to clear biz_role_permissions during delete for role ' + roleId);
    }

    // Hard delete the role
    const table = getTable(req, env.TABLE_ROLE);
    await table.deleteRow(roleId);

    return { message: 'Role hard-deleted successfully and users reassigned.' };
  },

  async restoreRole(id, req) {
    throw new Error(`Restore not supported: sys_role table does not support soft-deletion columns.`);
  },

  async createRoleWithPermissions(roleName, nestedPermissions, req) {
    const parentMap = new Map();
    const permissionNames = flattenPermissionsTree(nestedPermissions, parentMap);

    // Create the role
    const createdRole = await this.createRole({ name: roleName }, req);

    // Map permissions
    if (permissionNames.length > 0) {
      await this.mapPermissionsToRole(createdRole.id, permissionNames, req);
    }

    return {
      message: `Role "${roleName}" created successfully with permissions mapped`,
      role: createdRole
    };
  },

  async mapPermissionsToRole(roleId, permissionNames, req) {
    // 1. Verify role exists
    const checkRoleQuery = `SELECT * FROM ${env.TABLE_ROLE} WHERE ROWID = '${roleId}'`;
    const checkRoleResult = await executeQuery(req, checkRoleQuery);
    if (!checkRoleResult || checkRoleResult.length === 0) {
      throw new Error(`Role with ID ${roleId} not found`);
    }

    if (permissionNames.length === 0) {
      return { message: 'No permissions to map' };
    }

    // Fetch all system and business permissions to build lookup trees
    const allSysPermsResult = await executeQuery(req, `SELECT * FROM ${env.TABLE_PERMISSION}`).catch(() => []);
    const allBizPermsResult = await executeQuery(req, `SELECT * FROM ${env.TABLE_BIZ_PERMISSION}`).catch(() => []);

    const allSysPerms = allSysPermsResult.map(p => p[env.TABLE_PERMISSION]);
    const allBizPerms = allBizPermsResult.map(p => p[env.TABLE_BIZ_PERMISSION]);

    const sysNameToPerm = new Map(allSysPerms.map(p => [p.permission_name, p]));
    const sysIdToPerm = new Map(allSysPerms.map(p => [p.ROWID, p]));
    
    const bizNameToPerm = new Map(allBizPerms.map(p => [p.permission_name, p]));
    const bizIdToPerm = new Map(allBizPerms.map(p => [p.ROWID, p]));

    const collectedSys = new Map();
    const collectedBiz = new Map();
    const missingNames = [];

    const collectSysAncestors = (perm) => {
      if (collectedSys.has(perm.ROWID)) return;
      collectedSys.set(perm.ROWID, perm);
      if (perm.parent_id) {
        const parent = sysIdToPerm.get(perm.parent_id);
        if (parent) collectSysAncestors(parent);
      }
    };

    const collectBizAncestors = (perm) => {
      if (collectedBiz.has(perm.ROWID)) return;
      collectedBiz.set(perm.ROWID, perm);
      if (perm.parent_id) {
        const parent = bizIdToPerm.get(perm.parent_id);
        if (parent) collectBizAncestors(parent);
      }
    };

    for (const name of permissionNames) {
      if (sysNameToPerm.has(name)) {
        collectSysAncestors(sysNameToPerm.get(name));
      } else if (bizNameToPerm.has(name)) {
        collectBizAncestors(bizNameToPerm.get(name));
      } else {
        missingNames.push(name);
      }
    }

    if (missingNames.length > 0) {
      throw new Error(`Permissions not found: ${missingNames.join(', ')}`);
    }

    // Clear existing system mappings
    const rpTable = getTable(req, env.TABLE_ROLE_PERMISSION);
    const currentRpResult = await executeQuery(req, `SELECT ROWID FROM ${env.TABLE_ROLE_PERMISSION} WHERE role_id = '${roleId}'`).catch(() => []);
    for (const rowObj of currentRpResult) {
      await rpTable.deleteRow(rowObj[env.TABLE_ROLE_PERMISSION].ROWID);
    }

    // Clear existing business mappings
    try {
      const brpTable = getTable(req, env.TABLE_BIZ_ROLE_PERMISSION);
      const currentBrpResult = await executeQuery(req, `SELECT ROWID FROM ${env.TABLE_BIZ_ROLE_PERMISSION} WHERE role_id = '${roleId}'`).catch(() => []);
      for (const rowObj of currentBrpResult) {
        await brpTable.deleteRow(rowObj[env.TABLE_BIZ_ROLE_PERMISSION].ROWID);
      }
    } catch (e) {
      logger.warn('Could not clear biz_role_permissions for role ' + roleId);
    }

    // Save new mappings
    const addedSystem = [];
    for (const perm of collectedSys.values()) {
      const inserted = await rpTable.insertRow({ role_id: roleId, permission_id: perm.ROWID });
      addedSystem.push(inserted.ROWID);
    }

    const addedBiz = [];
    try {
      const brpTable = getTable(req, env.TABLE_BIZ_ROLE_PERMISSION);
      for (const perm of collectedBiz.values()) {
        const inserted = await brpTable.insertRow({ role_id: roleId, permission_id: perm.ROWID });
        addedBiz.push(inserted.ROWID);
      }
    } catch(e) {
      logger.warn('Could not save biz_role_permissions for role ' + roleId);
    }

    return {
      message: 'System and business permissions mapped successfully (hierarchy respected)',
      addedSystem: addedSystem.length,
      addedBusiness: addedBiz.length
    };
  }
};
