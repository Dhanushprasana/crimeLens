'use strict';

const repository = require('./permission.repository');
const logger = require('../../../config/logger');

module.exports = {
  async createPermissions(dto, req) {
    const permissionsArray = Array.isArray(dto) ? dto : dto?.permissions;
    logger.info(`createPermissionsBulk called with ${permissionsArray?.length || 0} items`);
    if (!permissionsArray || !Array.isArray(permissionsArray)) {
      throw new Error('Invalid payload structure: payload must be an array of permissions or contain a permissions array property');
    }
    return repository.createPermissions(permissionsArray, req);
  },

  async findAll(req) {
    logger.info('findAll permissions called');
    return repository.findAll(req);
  },

  async updatePermission(id, dto, req) {
    logger.info(`updatePermission called for ID: ${id}`);
    return repository.updatePermission(id, dto, req);
  },

  async softDeletePermission(id, req) {
    logger.info(`softDeletePermission called with ID: ${id}`);
    return repository.softDeletePermission(id, req);
  },

  async restorePermission(id, req) {
    logger.info(`restorePermission called with ID: ${id}`);
    return repository.restorePermission(id, req);
  },

  async hardDeletePermission(id, req) {
    logger.info(`hardDeletePermission called with ID: ${id}`);
    return repository.hardDeletePermission(id, req);
  }
};
