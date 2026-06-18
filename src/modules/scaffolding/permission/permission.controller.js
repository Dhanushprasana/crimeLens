'use strict';

const service = require('./permission.service');
const sendResponse = require('../../../common/response');
const logger = require('../../../config/logger');

function throwServiceError(error, context) {
  logger.error(`Error in ${context}: ${error.message}`, { stack: error.stack });
  throw error;
}

module.exports = {
  async createPermission(req, res, next) {
    try {
      const result = await service.createPermissions(req.body, req);
      sendResponse(res, result, 200);
    } catch (error) {
      next(error);
    }
  },

  async findAll(req, res, next) {
    try {
      const result = await service.findAll(req);
      sendResponse(res, result, 200);
    } catch (error) {
      next(error);
    }
  },

  async updatePermission(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.updatePermission(id, req.body, req);
      sendResponse(res, result, 200);
    } catch (error) {
      next(error);
    }
  },

  async softDeletePermission(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.softDeletePermission(id, req);
      sendResponse(res, result, 200);
    } catch (error) {
      next(error);
    }
  },

  async restorePermission(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.restorePermission(id, req);
      sendResponse(res, result, 200);
    } catch (error) {
      next(error);
    }
  },

  async hardDeletePermission(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.hardDeletePermission(id, req);
      sendResponse(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
};
