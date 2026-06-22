"use strict";

const service = require("./dashboard.service");
const sendResponse = require("../../../common/response");

module.exports = {
  async getDistrictCrimeStats(req, res, next) {
    try {
      const result = await service.getDistrictCrimeStats(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getTotalCrimeCount(req, res, next) {
    try {
      const result = await service.getTotalCrimeCount(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
};
