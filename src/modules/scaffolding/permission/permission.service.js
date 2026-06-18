'use strict';

const repository = require('./permission.repository');
const logger = require('../../../config/logger');

module.exports = {
  async createPermissions(dto, req) {
    logger.info(`createPermissionsBulk called with ${dto?.permissions?.length || 0} items`);
    if (!dto || !Array.isArray(dto.permissions)) {
      throw new Error('Invalid payload structure: permissions must be an array');
    }
    return repository.createPermissions(dto.permissions, req);
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
