'use strict';

const service = require('./configuration.service');
const sendResponse = require('../../../common/response');

module.exports = {
  async upsertConfig(req, res, next) {
    try {
      // Use email (header x-user-email or query param) for branding configs
      const email = req.headers['x-user-email'] || req.query.email;
      const result = await service.upsertConfig(req.body, email, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getConfig(req, res, next) {
    try {
      const { name } = req.params;
      const email = req.headers['x-user-email'] || req.query.email;
      const result = await service.getConfig(name, email, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getAllConfigs(req, res, next) {
    try {
      const email = req.headers['x-user-email'] || req.query.email;
      const result = await service.getAllConfigs(email, req);
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
