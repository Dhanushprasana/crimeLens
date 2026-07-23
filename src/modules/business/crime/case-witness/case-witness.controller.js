'use strict';

const service = require('./case-witness.service');
const sendResponse = require('../../../../common/response');

module.exports = {
  async addWitness(req, res, next) {
    try { const result = await service.addWitness(req.body, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  },
  async getWitnessesByIncident(req, res, next) {
    try { const { incidentId } = req.params; const result = await service.getWitnessesByIncident(incidentId, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  },
  async getOneWitness(req, res, next) {
    try { const { id } = req.params; const result = await service.getOneWitness(id, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  },
  async updateWitness(req, res, next) {
    try { const { id } = req.params; const result = await service.updateWitness(id, req.body, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  },
  async deleteWitness(req, res, next) {
    try { const { id } = req.params; const result = await service.deleteWitness(id, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  }
};
