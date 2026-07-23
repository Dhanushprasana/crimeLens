'use strict';

const service = require('./suspect-photo.service');
const sendResponse = require('../../../../common/response');

module.exports = {
  async addSuspectPhoto(req, res, next) {
    try { const result = await service.addSuspectPhoto(req.body, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  },
  async getPhotosBySuspect(req, res, next) {
    try { const { suspectId } = req.params; const result = await service.getPhotosBySuspect(suspectId, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  },
  async deleteSuspectPhoto(req, res, next) {
    try { const { id } = req.params; const result = await service.deleteSuspectPhoto(id, req); sendResponse(res, result, 200); } catch (err) { next(err); }
  }
};
