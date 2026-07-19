'use strict';

const service      = require('./evidence-match.service');
const sendResponse = require('../../../common/response');

module.exports = {
  async create(req, res, next) {
    try {
      const result = await service.create(req.body, req);
      sendResponse(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  async getAll(req, res, next) {
    try {
      const result = await service.getAll(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const result = await service.getById(req.params.id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getBySourceEvidence(req, res, next) {
    try {
      const result = await service.getBySourceEvidence(req.params.sourceId, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const result = await service.update(req.params.id, req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const result = await service.remove(req.params.id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
};
