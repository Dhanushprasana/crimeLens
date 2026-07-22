"use strict";

const service = require("./auth.service");
const sendResponse = require("../../common/response");

module.exports = {
  async login(req, res, next) {
    try {
      const result = await service.login(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async refreshTokens(req, res, next) {
    try {
      const result = await service.refreshTokens(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getMe(req, res, next) {
    try {
      // Pass req.user from authenticateJWT if it exists
      const query = { ...req.query, ...req.body, user: req.user };
      const result = await service.getMe(query, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async logOut(req, res, next) {
    try {
      const result = await service.logOut(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
};
