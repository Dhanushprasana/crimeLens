'use strict';

const service = require('./role.service');
const sendResponse = require('../../../common/response');

module.exports = {
  async createRole(req, res, next) {
    try {
      const result = await service.createRole(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async findAllRoles(req, res, next) {
    try {
      const result = await service.findAllRoles(req.query, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async findRoleById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.findRoleById(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async updateRole(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.updateRoleAndPermissions(id, req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async softDeleteRole(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.softDeleteRole(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async restoreRole(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.restoreRole(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async createRoleWithPermissions(req, res, next) {
    try {
      const { roleName, permission } = req.body;
      const result = await service.createRoleWithPermissions(roleName, permission || [], req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async mapPermissionsToRole(req, res, next) {
    try {
      const { roleId } = req.params;
      const { permissionNames } = req.body;
      const result = await service.mapPermissionsToRole(roleId, permissionNames || [], req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
};
