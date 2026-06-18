'use strict';

const repository = require('./configuration.repository');
const logger = require('../../../config/logger');

module.exports = {
  async upsertConfig(dto, userId, req) {
    logger.info(`upsertConfig called for configuration name: ${dto?.name}`);
    if (!dto || !dto.name || !dto.config) {
      throw new Error('Invalid config payload. name and config object are required.');
    }
    return repository.upsertConfig(dto, userId, req);
  },

  async getConfig(name, userId, req) {
    logger.info(`getConfig called for: ${name}`);
    return repository.getConfig(name, userId, req);
  },

  async getAllConfigs(userId, req) {
    logger.info('getAllConfigs called');
    return repository.getAllConfigs(userId, req);
  },

  async updateUploadPath(path, req) {
    logger.info(`updateUploadPath called with path: ${path}`);
    if (!path) {
      throw new Error('Upload path is required');
    }
    return repository.upsertConfig({
      name: 'path',
      config: {
        storagePath: path
      }
    }, null, req);
  }
};
