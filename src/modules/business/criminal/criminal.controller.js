'use strict';

const service = require('./criminal.service');
const sendResponse = require('../../../common/response');

module.exports = {
  async addCriminal(req, res, next) { try { const result = await service.addCriminal(req.body, req); sendResponse(res, result, 200); } catch (err) { next(err); } },
  async getAllCriminals(req, res, next) { try { const result = await service.getAllCriminals(req.query, req); sendResponse(res, result, 200); } catch (err) { next(err); } },
  async getOneCriminal(req, res, next) { try { const { id } = req.params; const result = await service.getOneCriminal(id, req); sendResponse(res, result, 200); } catch (err) { next(err); } },
  async updateCriminal(req, res, next) { try { const { id } = req.params; const result = await service.updateCriminal(id, req.body, req); sendResponse(res, result, 200); } catch (err) { next(err); } },
  async deleteCriminal(req, res, next) { try { const { id } = req.params; const result = await service.deleteCriminal(id, req); sendResponse(res, result, 200); } catch (err) { next(err); } }
};
