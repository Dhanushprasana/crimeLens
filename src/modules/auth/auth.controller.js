"use strict";

const service = require("./auth.service");
const sendResponse = require("../../common/response");

module.exports = {
  async getMe(req, res, next) {
    try {
      const result = await service.getMe({ ...req.query, ...req.body }, req);
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
