'use strict';

const service = require('./case-victim.service');
const sendResponse = require('../../../../common/response');

module.exports = {
  async addVictim(req, res, next) {
    try { const result = await service.addVictim(req.body, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  },
  async getVictimsByIncident(req, res, next) {
    try { const { incidentId } = req.params; const result = await service.getVictimsByIncident(incidentId, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  },
  async getOneVictim(req, res, next) {
    try { const { id } = req.params; const result = await service.getOneVictim(id, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  },
  async updateVictim(req, res, next) {
    try { const { id } = req.params; const result = await service.updateVictim(id, req.body, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  },
  async deleteVictim(req, res, next) {
    try { const { id } = req.params; const result = await service.deleteVictim(id, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  }
};
