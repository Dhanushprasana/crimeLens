"use strict";

const service = require("./fir.service");
const sendResponse = require("../../../common/response");

module.exports = {
  async addFir(req, res, next) {
    try {
      const result = await service.addFir(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
  async getAllFir(req, res, next) {
    try {
      const result = await service.getAllFir(req.query, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
  async getOneFir(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.getOneFir(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
  async updateFir(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.updateFir(id, req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
  async deleteFir(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.deleteFir(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
};
