'use strict';

const repository = require('./role.repository');
const logger = require('../../../config/logger');

module.exports = {
  async createRole(dto, req) {
    logger.info(`createRole called for name: ${dto?.name}`);
    if (!dto || !dto.name) {
      throw new Error('Role name is required');
    }
    return repository.createRole(dto, req);
  },

  async findAllRoles(query, req) {
    logger.info('findAllRoles called');
    return repository.findAllRoles(query, req);
  },

  async findRoleById(id, req) {
    logger.info(`findRoleById called with ID: ${id}`);
    return repository.findRoleById(id, req);
  },

  async updateRoleAndPermissions(id, dto, req) {
    logger.info(`updateRoleAndPermissions called with ID: ${id}`);
    return repository.updateRoleAndPermissions(id, dto, req);
  },

  async softDeleteRole(id, req) {
    logger.info(`softDeleteRole called with ID: ${id}`);
    return repository.softDeleteRole(id, req);
  },

  async restoreRole(id, req) {
    logger.info(`restoreRole called with ID: ${id}`);
    return repository.restoreRole(id, req);
  },

  async createRoleWithPermissions(roleName, permissions, req) {
    logger.info(`createRoleWithPermissions called for: ${roleName}`);
    if (!roleName) {
      throw new Error('roleName is required');
    }
    return repository.createRoleWithPermissions(roleName, permissions, req);
  },

  async mapPermissionsToRole(roleId, permissionNames, req) {
    logger.info(`mapPermissionsToRole called for role: ${roleId}`);
    return repository.mapPermissionsToRole(roleId, permissionNames, req);
  }
};
