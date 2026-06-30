'use strict';

const service = require('./suspect.service');
const sendResponse = require('../../../common/response');

module.exports = {
  async addSuspect(req, res, next) { try { const result = await service.addSuspect(req.body, req); sendResponse(res, result, 200); } catch (err) { next(err); } },
  async getAllSuspects(req, res, next) { try { const result = await service.getAllSuspects(req.query, req); sendResponse(res, result, 200); } catch (err) { next(err); } },
  async getOneSuspect(req, res, next) { try { const { id } = req.params; const result = await service.getOneSuspect(id, req); sendResponse(res, result, 200); } catch (err) { next(err); } },
  async updateSuspect(req, res, next) { try { const { id } = req.params; const result = await service.updateSuspect(id, req.body, req); sendResponse(res, result, 200); } catch (err) { next(err); } },
  async deleteSuspect(req, res, next) { try { const { id } = req.params; const result = await service.deleteSuspect(id, req); sendResponse(res, result, 200); } catch (err) { next(err); } }
};  
