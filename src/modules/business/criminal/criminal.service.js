'use strict';

const repository = require('./criminal.repository');
const logger = require('../../../config/logger');

module.exports = {
  async addCriminal(dto, req) { logger.info('addCriminal'); if (!dto || !dto.full_name) throw new Error('full_name required'); return repository.addCriminal(dto, req); },
  async getAllCriminals(query, req) { logger.info('getAllCriminals'); return repository.getAllCriminals(query, req); },
  async getOneCriminal(id, req) { logger.info(`getOneCriminal ${id}`); return repository.getOneCriminal(id, req); },
  async updateCriminal(id, dto, req) { logger.info(`updateCriminal ${id}`); return repository.updateCriminal(id, dto, req); },
  async deleteCriminal(id, req) { logger.info(`deleteCriminal ${id}`); return repository.deleteCriminal(id, req); }
};
