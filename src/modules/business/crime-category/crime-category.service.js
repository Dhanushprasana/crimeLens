'use strict';

const repository = require('./crime-category.repository');
const logger = require('../../../config/logger');

module.exports = {
  async addCrimeCategory(dto, req) {
    logger.info('addCrimeCategory');
    if (!dto || !dto.crime_category_name || !dto.crime_category_number) {
      throw new Error('crime_category_name and crime_category_number are required');
    }
    return repository.addCrimeCategory(dto, req);
  },

  async getAllCrimeCategories(query, req) {
    logger.info('getAllCrimeCategories');
    return repository.getAllCrimeCategories(query, req);
  },

  async getOneCrimeCategory(id, req) {
    logger.info(`getOneCrimeCategory ${id}`);
    return repository.getOneCrimeCategory(id, req);
  },

  async updateCrimeCategory(id, dto, req) {
    logger.info(`updateCrimeCategory ${id}`);
    return repository.updateCrimeCategory(id, dto, req);
  },

  async deleteCrimeCategory(id, req) {
    logger.info(`deleteCrimeCategory ${id}`);
    return repository.deleteCrimeCategory(id, req);
  }
};
