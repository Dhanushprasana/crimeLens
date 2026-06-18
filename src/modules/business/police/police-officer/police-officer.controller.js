'use strict';

const service = require('./police-officer.service');
const sendResponse = require('../../../../common/response');

module.exports = {
  async createOfficer(req, res, next) {
    try {
      const result = await service.createOfficer(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getAllOfficers(req, res, next) {
    try {
      const result = await service.getAllOfficers(req.query, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getOneOfficer(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.getOneOfficer(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async updateOfficer(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.updateOfficer(id, req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async softDeleteOfficer(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.softDeleteOfficer(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async createRank(req, res, next) {
    try {
      const result = await service.createRank(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getAllRanks(req, res, next) {
    try {
      const result = await service.getAllRanks(req.query, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async deleteRank(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.deleteRank(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
};
