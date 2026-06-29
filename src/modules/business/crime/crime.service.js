'use strict';

const repository = require('./crime.repository');
const logger = require('../../../config/logger');

module.exports = {
  async addCrime(dto, req) { logger.info('addCrime'); if (!dto || !dto.title) throw new Error('title required'); return repository.addCrime(dto, req); },
  async addCrimesBulk(dtos, req) { logger.info('addCrimesBulk'); if (!Array.isArray(dtos)) throw new Error('payload must be an array'); return repository.addCrimesBulk(dtos, req); },
  async getAllCrimes(query, req) { logger.info('getAllCrimes'); return repository.getAllCrimes(query, req); },
  async getOneCrime(id, req) { logger.info(`getOneCrime ${id}`); return repository.getOneCrime(id, req); },
  async updateCrime(id, dto, req) { logger.info(`updateCrime ${id}`); return repository.updateCrime(id, dto, req); },
  async deleteCrime(id, req) { logger.info(`deleteCrime ${id}`); return repository.deleteCrime(id, req); }
};
