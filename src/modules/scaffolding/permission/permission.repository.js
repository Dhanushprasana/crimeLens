'use strict';

const env = require('../../../config/env');
const logger = require('../../../config/logger');

// Helper to query Catalyst ZCQL
async function executeQuery(req, query) {
  if (!req.catalyst) {
    throw new Error('Catalyst SDK is not initialized in request');
  }
  const zcql = req.catalyst.zcql();
  const result = await zcql.executeZCQLQuery(query);
  return result;
}

// Helper to get Catalyst Table
function getTable(req, tableName) {
  if (!req.catalyst) {
    throw new Error('Catalyst SDK is not initialized in request');
  }
  return req.catalyst.datastore().table(tableName);
}

module.exports = {
  async createPermissions(permissionsList, req) {
    const created = [];
    const skipped = [];
    const table = getTable(req, env.TABLE_PERMISSION);

    for (const dto of permissionsList) {
      const name = dto.name.trim();
      const description = dto.description?.trim() || null;

      // Lookup existing permission by name
      const existQuery = `SELECT * FROM ${env.TABLE_PERMISSION} WHERE permission_name = '${name}'`;
      const existResult = await executeQuery(req, existQuery);

      if (existResult && existResult.length > 0) {
        // Since sys_permission only has ROWID, CREATORID, CREATEDTIME, MODIFIEDTIME, description, and permission_name,
        // there is no parentId, soft-delete columns (deletedAt/deleted/isEnabled).
        // If it exists, we skip creating it to avoid violating the unique constraint on permission_name.
        skipped.push(name);
        continue;
      }

      // Create new permission
      const newPerm = {
        permission_name: name,
        description: description
      };

      const saved = await table.insertRow(newPerm);
      created.push({ id: saved.ROWID, name: saved.permission_name });
    }

    return {
      message: 'Permissions created successfully',
      created,
      skipped
    };
  },

  async findAll(req) {
    // Fetch all permissions from sys_permission
    const query = `SELECT * FROM ${env.TABLE_PERMISSION}`;
    const dbResult = await executeQuery(req, query);

    const system = dbResult.map(r => {
      const perm = r[env.TABLE_PERMISSION];
      return {
        id: perm.ROWID,
        name: perm.permission_name,
        description: perm.description,
        enabled: true, // Mocked as true since column doesn't exist
        createdAt: perm.CREATEDTIME,
        updatedAt: perm.MODIFIEDTIME
      };
    });

    // Since sys_permission does not have parentId, hierarchy (business roots) is empty
    return {
      system,
      business: []
    };
  },

  async updatePermission(id, dto, req) {
    const table = getTable(req, env.TABLE_PERMISSION);
    
    // Check if permission exists
    const checkQuery = `SELECT * FROM ${env.TABLE_PERMISSION} WHERE ROWID = '${id}'`;
    const checkResult = await executeQuery(req, checkQuery);
    if (!checkResult || checkResult.length === 0) {
      throw new Error(`Permission with ID ${id} not found`);
    }

    const permission = checkResult[0][env.TABLE_PERMISSION];
    const updatePayload = { ROWID: id };

    if (dto.name && dto.name.trim() !== permission.permission_name) {
      const name = dto.name.trim();

      // Check duplicates globally
      const dupQuery = `SELECT * FROM ${env.TABLE_PERMISSION} WHERE permission_name = '${name}' AND ROWID != '${id}'`;
      const dupResult = await executeQuery(req, dupQuery);
      if (dupResult && dupResult.length > 0) {
        throw new Error(`Duplicate permission name '${name}'`);
      }

      updatePayload.permission_name = name;
    }

    if (dto.description !== undefined) {
      updatePayload.description = dto.description?.trim() || null;
    }

    if (Object.keys(updatePayload).length > 1) {
      await table.updateRow(updatePayload);
      logger.info(`Permission updated successfully with ID: ${id}`);
    }

    return { message: 'Permission updated successfully' };
  },

  async softDeletePermission(id, req) {
    // Since there is no soft delete metadata column (like deletedAt) in sys_permission schema,
    // we fallback to hard delete or raise a message explaining it's hard deleted directly.
    logger.warn(`Soft delete requested for ID ${id}, performing hard delete due to schema limitations.`);
    return this.hardDeletePermission(id, req);
  },

  async restorePermission(id, req) {
    // Restore is a no-op / error since no soft-deletion flag exists in the schema.
    throw new Error(`Restore not supported: sys_permission table does not support soft-deletion columns.`);
  },

  async hardDeletePermission(id, req) {
    const table = getTable(req, env.TABLE_PERMISSION);

    // Verify it exists
    const checkQuery = `SELECT * FROM ${env.TABLE_PERMISSION} WHERE ROWID = '${id}'`;
    const checkResult = await executeQuery(req, checkQuery);
    if (!checkResult || checkResult.length === 0) {
      throw new Error(`Permission with ID ${id} not found`);
    }

    // Delete role mapping entries from sys_role_permission first
    const rpTable = getTable(req, env.TABLE_ROLE_PERMISSION);
    const rpQuery = `SELECT ROWID FROM ${env.TABLE_ROLE_PERMISSION} WHERE permission_id = '${id}'`;
    const rpResult = await executeQuery(req, rpQuery);
    for (const rowObj of rpResult) {
      await rpTable.deleteRow(rowObj[env.TABLE_ROLE_PERMISSION].ROWID);
    }

    // Delete permission
    await table.deleteRow(id);

    return {
      message: 'Permission hard-deleted successfully'
    };
  }
};
