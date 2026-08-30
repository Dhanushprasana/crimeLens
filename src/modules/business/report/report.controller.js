'use strict';

const reportService = require('./report.service');

module.exports = {
  async downloadReport(req, res, next) {
    try {
      const report = await reportService.buildReport(req.query, req);
      await reportService.streamPdf(report, res);
    } catch (error) {
      next(error);
    }
  }
};
