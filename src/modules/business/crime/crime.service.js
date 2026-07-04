'use strict';

const repository = require('./crime.repository');
const logger     = require('../../../config/logger');
const { AppError } = require('../../../common/exceptions');

// Allowed values for whitelist validation
const ALLOWED_SORT_BY    = new Set(['crime_occured_date_time', 'createdtime', 'crime_number', 'status']);
const ALLOWED_SORT_ORDER = new Set(['ASC', 'DESC']);
const DATE_REGEX         = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAGE_SIZE      = 100;

module.exports = {
  async addCrime(dto, req) { logger.info('addCrime'); if (!dto || !dto.title) throw new AppError('title required', 400); return repository.addCrime(dto, req); },

  async getAllCrimes(query, req) {
    logger.info('getAllCrimes');

    // --- page ---
    const page = parseInt(query.page, 10);
    if (query.page !== undefined && (isNaN(page) || page < 1)) {
      throw new AppError('page must be a positive integer', 400);
    }

    // --- pageSize ---
    const pageSize = parseInt(query.pageSize, 10);
    if (query.pageSize !== undefined && (isNaN(pageSize) || pageSize < 1)) {
      throw new AppError('pageSize must be a positive integer', 400);
    }
    if (pageSize > MAX_PAGE_SIZE) {
      throw new AppError(`pageSize cannot exceed ${MAX_PAGE_SIZE}`, 400);
    }

    // --- sortBy ---
    if (query.sortBy && !ALLOWED_SORT_BY.has(query.sortBy)) {
      throw new AppError(
        `sortBy must be one of: ${[...ALLOWED_SORT_BY].join(', ')}`,
        400
      );
    }

    // --- sortOrder ---
    if (query.sortOrder && !ALLOWED_SORT_ORDER.has(query.sortOrder.toUpperCase())) {
      throw new AppError('sortOrder must be ASC or DESC', 400);
    }

    // --- date / from / to format validation ---
    for (const field of ['date', 'from', 'to']) {
      if (query[field] && !DATE_REGEX.test(query[field])) {
        throw new AppError(`${field} must be in YYYY-MM-DD format`, 400);
      }
    }

    // Build a clean, typed params object for the repository
    const params = {
      page:      isNaN(page)     ? 1  : page,
      pageSize:  isNaN(pageSize) ? 20 : pageSize,
      search:    query.search    || null,
      districtId: query.districtId || null,
      stationId:  query.stationId  || null,
      categoryId: query.categoryId || null,
      status:     query.status     || null,
      date:       query.date       || null,
      from:       query.from       || null,
      to:         query.to         || null,
      sortBy:     query.sortBy     || null,
      sortOrder:  query.sortOrder  ? query.sortOrder.toUpperCase() : 'DESC'
    };

    return repository.getAllCrimes(params, req);
  },

  async getOneCrime(id, req) { logger.info(`getOneCrime ${id}`); return repository.getOneCrime(id, req); },
  async updateCrime(id, dto, req) { logger.info(`updateCrime ${id}`); return repository.updateCrime(id, dto, req); },
  async deleteCrime(id, req) { logger.info(`deleteCrime ${id}`); return repository.deleteCrime(id, req); }
};
