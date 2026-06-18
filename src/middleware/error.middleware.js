'use strict';
const logger = require('../config/logger');

module.exports = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, path: req.originalUrl });
  const status = err.status || 500;
  res.status(status).json({ success: false, error: err.message });
};
