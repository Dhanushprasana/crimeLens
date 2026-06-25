'use strict';

const service = require('./criminal-profiling.service');
const sendResponse = require('../../../common/response');

module.exports = {
  async generateProfile(req, res, next) {
    try {
      const { criminalId } = req.params;

      const result =
        await service.generateProfile(
          criminalId,
          req
        );

      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getProfile(req, res, next) {
    try {
      const { criminalId } = req.params;

      const result =
        await service.getProfile(
          criminalId,
          req
        );

      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getRiskFactors(req, res, next) {
    try {
      const { criminalId } = req.params;

      const result =
        await service.getRiskFactors(
          criminalId,
          req
        );

      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
};