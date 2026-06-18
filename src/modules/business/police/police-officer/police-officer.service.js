'use strict';

const repository = require('./police-officer.repository');
const logger = require('../../../../config/logger');

module.exports = {
  async createOfficer(dto, req) {
    logger.info('createOfficer service called');
    if (!dto || !dto.badge_number || !dto.email) {
      throw new Error('badge_number and email are required');
    }
    return repository.createOfficer(dto, req);
  },

  async getAllOfficers(query, req) {
    logger.info('getAllOfficers service called');
    return repository.getAllOfficers(query, req);
  },

  async getOneOfficer(id, req) {
    logger.info(`getOneOfficer called for ID: ${id}`);
    return repository.getOneOfficer(id, req);
  },

  async updateOfficer(id, dto, req) {
    logger.info(`updateOfficer called for ID: ${id}`);
    return repository.updateOfficer(id, dto, req);
  },

  async softDeleteOfficer(id, req) {
    logger.info(`softDeleteOfficer called for ID: ${id}`);
    return repository.softDeleteOfficer(id, req);
  },

  async createRank(dto, req) {
    logger.info('createRank called');
    if (!dto || !dto.rank_name) {
      throw new Error('rank_name is required');
    }
    return repository.createRank(dto, req);
  },

  async getAllRanks(query, req) {
    logger.info('getAllRanks called');
    return repository.getAllRanks(query, req);
  },

  async deleteRank(id, req) {
    logger.info(`deleteRank called for ID: ${id}`);
    return repository.deleteRank(id, req);
  }
};
