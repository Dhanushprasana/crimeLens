"use strict";

const service = require("./user-invites.service");
const sendResponse = require("../../../common/response");

module.exports = {
  async inviteUser(req, res, next) {
    try {
      const result = await service.inviteUser(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getAllInvites(req, res, next) {
    try {
      const result = await service.getAllInvites(req.query, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async checkInvite(req, res, next) {
    try {
      const result = await service.checkInvite(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async acceptInvite(req, res, next) {
    try {
      const result = await service.acceptInvite(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async createUserFromInvite(req, res, next) {
    try {
      const result = await service.createUserFromInvite(req.body, req);
      sendResponse(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  async resendInvite(req, res, next) {
    try {
      const result = await service.resendInvite(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
};
