'use strict';

const service = require('./crime.service');
const sendResponse = require('../../../common/response');

module.exports = {
  async addCrime(req, res, next) { try { const result = await service.addCrime(req.body, req); sendResponse(res, result, 200); } catch (err) { next(err); } },
  async addCrimesBulk(req, res, next) { try { const result = await service.addCrimesBulk(req.body, req); sendResponse(res, result, 200); } catch (err) { next(err); } },
  async getAllCrimes(req, res, next) { try { const result = await service.getAllCrimes(req.query, req); sendResponse(res, result, 200); } catch (err) { next(err); } },
  async getOneCrime(req, res, next) { try { const { id } = req.params; const result = await service.getOneCrime(id, req); sendResponse(res, result, 200); } catch (err) { next(err); } },
  async updateCrime(req, res, next) { try { const { id } = req.params; const result = await service.updateCrime(id, req.body, req); sendResponse(res, result, 200); } catch (err) { next(err); } },
  async deleteCrime(req, res, next) { try { const { id } = req.params; const result = await service.deleteCrime(id, req); sendResponse(res, result, 200); } catch (err) { next(err); } }
};
