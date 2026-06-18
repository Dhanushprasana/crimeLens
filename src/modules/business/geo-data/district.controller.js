"use strict";

const service = require("./district.service");
const sendResponse = require("../../../common/response");

module.exports = {
  async addDistrict(req, res, next) {
    try {
      const result = await service.addDistrict(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getAllDistrict(req, res, next) {
    try {
      const result = await service.getAllDistrict(req.query, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getOneDistrict(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.getOneDistrict(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async deleteDistrict(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.deleteDistrict(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
  async addDistrictGeoJson(req, res, next) {
    try {
      const result = await service.addDistrictGeoJson(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getAllDistrictGeoJson(req, res, next) {
    try {
      const result = await service.getAllDistrictGeoJson(req.query, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getOneDistrictGeoJson(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.getOneDistrictGeoJson(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async deleteDistrictGeoJson(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.deleteDistrictGeoJson(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async bootstrapDistrictGeoJson(req, res, next) {
    try {
      const result = await service.bootstrapDistrictGeoJson(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
};
