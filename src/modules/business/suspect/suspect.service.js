'use strict';

const repository = require('./suspect.repository');
const logger = require('../../../config/logger');

module.exports = {
  async addSuspect(dto, req) { logger.info('addSuspect'); if (!dto || !dto.full_name) throw new Error('full_name required'); return repository.addSuspect(dto, req); },
  async getAllSuspects(query, req) { logger.info('getAllSuspects'); return repository.getAllSuspects(query, req); },
  async getOneSuspect(id, req) { logger.info(`getOneSuspect ${id}`); return repository.getOneSuspect(id, req); },
  async updateSuspect(id, dto, req) { logger.info(`updateSuspect ${id}`); return repository.updateSuspect(id, dto, req); },
  async deleteSuspect(id, req) { logger.info(`deleteSuspect ${id}`); return repository.deleteSuspect(id, req); }
};  
