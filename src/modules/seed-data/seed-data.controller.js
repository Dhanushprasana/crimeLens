"use strict";

const service = require("./seed-data.service");
const sendResponse = require("../../common/response");

module.exports = {
  async bootstrapDistrictGeoJson(req, res, next) {
    try {
      const result = await service.bootstrapDistrictGeoJson(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
  async bootstrapPoliceRank(req, res, next) {
    try {
      const result = await service.bootstrapPoliceRank(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
};
