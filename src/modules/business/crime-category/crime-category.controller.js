'use strict';

const service = require('./crime-category.service');
const sendResponse = require('../../../common/response');

module.exports = {
  async addCrimeCategory(req, res, next) {
    try {
      const result = await service.addCrimeCategory(req.body, req);
      sendResponse(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  async getAllCrimeCategories(req, res, next) {
    try {
      const result = await service.getAllCrimeCategories(req.query, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getOneCrimeCategory(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.getOneCrimeCategory(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async updateCrimeCategory(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.updateCrimeCategory(id, req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async deleteCrimeCategory(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.deleteCrimeCategory(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
};
