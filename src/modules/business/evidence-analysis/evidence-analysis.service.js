'use strict';

const repository = require('./evidence-analysis.repository');
const logger     = require('../../../config/logger');
const { AppError } = require('../../../common/exceptions');

const MAX_PATHS = 200; // guard against huge IN-lists

module.exports = {
  async getCrimesByEvidencePaths(paths, req) {
    logger.info('getCrimesByEvidencePaths');

    if (!Array.isArray(paths) || paths.length === 0) {
      throw new AppError('paths must be a non-empty array', 400);
    }

    if (paths.length > MAX_PATHS) {
      throw new AppError(`Cannot look up more than ${MAX_PATHS} paths at once`, 400);
    }

    // Ensure every element is a non-empty string
    const cleaned = paths.map(p => String(p).trim()).filter(Boolean);
    if (cleaned.length === 0) {
      throw new AppError('paths array contains no valid values', 400);
    }

    return repository.getCrimesByEvidencePaths(cleaned, req);
  }
};
