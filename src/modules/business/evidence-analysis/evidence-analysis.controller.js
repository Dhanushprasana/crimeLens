'use strict';

const service      = require('./evidence-analysis.service');
const sendResponse = require('../../../common/response');

module.exports = {
  async getCrimesByEvidencePaths(req, res, next) {
    try {
      // Accept comma-separated paths: ?paths=url1,url2,url3
      const raw = req.query.paths || '';
      const paths = raw
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);

      const result = await service.getCrimesByEvidencePaths(paths, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
};
