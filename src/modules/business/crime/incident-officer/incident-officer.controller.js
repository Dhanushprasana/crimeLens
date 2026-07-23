'use strict';

const service = require('./incident-officer.service');
const sendResponse = require('../../../../common/response');

module.exports = {
  async assignOfficer(req, res, next) {
    try { const result = await service.assignOfficer(req.body, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  },
  async getOfficersByIncident(req, res, next) {
    try { const { incidentId } = req.params; const result = await service.getOfficersByIncident(incidentId, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  },
  async getIncidentsByOfficer(req, res, next) {
    try { const { officerId } = req.params; const result = await service.getIncidentsByOfficer(officerId, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  },
  async removeOfficer(req, res, next) {
    try { const { id } = req.params; const result = await service.removeOfficer(id, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  }
};
