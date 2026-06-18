'use strict';

const repository = require('./fir.repository');
const logger = require('../../../config/logger');

module.exports = {
  async addFir(dto, req) { logger.info('addFir'); if (!dto || !dto.complainant_name) throw new Error('complainant_name required'); return repository.addFir(dto, req); },
  async getAllFir(query, req) { logger.info('getAllFir'); return repository.getAllFir(query, req); },
  async getOneFir(id, req) { logger.info(`getOneFir ${id}`); return repository.getOneFir(id, req); },
  async updateFir(id, dto, req) { logger.info(`updateFir ${id}`); return repository.updateFir(id, dto, req); },
  async deleteFir(id, req) { logger.info(`deleteFir ${id}`); return repository.deleteFir(id, req); }
};
