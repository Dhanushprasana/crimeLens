'use strict';

const logger = require('../../config/logger');
const aiService = require('./ai.service');
const sendResponse = require('../../common/response');

async function chat(req, res, next) {
  try {
    const message = req.body?.message || req.body?.prompt || '';
    // logger.info('AI controller received request', {
    //   method: req.method,
    //   path: req.originalUrl,
    //   body: req.body,
    //   headers: {
    //     authorization: req.headers.authorization ? 'present' : 'missing',
    //     'content-type': req.headers['content-type'],
    //   },
    // });

    const result = await aiService.chatWithAi({ message, req });
    // logger.info('AI controller returning response', { result });
    sendResponse(res, result, 200);
  } catch (err) {
    logger.error('AI controller error', {
      message: err.message,
      stack: err.stack,
      body: req.body,
    });
    next(err);
  }
}

module.exports = {
  chat,
};
