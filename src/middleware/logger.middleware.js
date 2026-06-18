// logger.middleware.js – simple request logger
'use strict';

const logger = require('../config/logger');

module.exports = (req, res, next) => {
  logger.info(`Incoming ${req.method} ${req.originalUrl}`);
  next();
};
