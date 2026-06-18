'use strict';

const service = require('./configuration.service');
const sendResponse = require('../../../common/response');

module.exports = {
  async upsertConfig(req, res, next) {
    try {
      // Mocking userId until auth token integration is set up
      const userId = req.user?.userId || 'mock-user-123';
      const result = await service.upsertConfig(req.body, userId, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getConfig(req, res, next) {
    try {
      const { name } = req.params;
      const userId = req.user?.userId || 'mock-user-123';
      const result = await service.getConfig(name, userId, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getAllConfigs(req, res, next) {
    try {
      const userId = req.user?.userId || 'mock-user-123';
      const result = await service.getAllConfigs(userId, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async updateUploadPath(req, res, next) {
    try {
      const { path } = req.body;
      const result = await service.updateUploadPath(path, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
};
