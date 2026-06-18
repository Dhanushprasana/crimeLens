'use strict';

const service = require('./user.service');
const sendResponse = require('../../../common/response');

module.exports = {
  async createUser(req, res, next) {
    try {
      const result = await service.createUser(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getAllUsers(req, res, next) {
    try {
      const result = await service.getAllUsers(req.query, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async restoreUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.restoreUser(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getAllUsersV2(req, res, next) {
    try {
      const result = await service.getAllUsersV2(req.query, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async updateUserRole(req, res, next) {
    try {
      const result = await service.updateUserRoleByEmail(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async deactivateUser(req, res, next) {
    try {
      const { email } = req.params;
      const result = await service.deactivateUser(email, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async activateUser(req, res, next) {
    try {
      const { email } = req.params;
      const result = await service.activateUser(email, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async deleteUser(req, res, next) {
    try {
      const { emails } = req.body;
      const result = await service.hardDeleteUser(emails || [], req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
};
