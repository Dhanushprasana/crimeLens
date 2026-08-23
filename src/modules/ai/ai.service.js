'use strict';

const logger = require('../../config/logger');
const { runGraph } = require('./ai.graph');
const { AppError } = require('../../common/exceptions');

async function chatWithAi({ message, req }) {
//   logger.info('AI service start', { message });

  if (!message || !String(message).trim()) {
    throw new AppError('A chat message is required.', 400);
  }

  const result = await runGraph({ message: String(message).trim(), req });
//   logger.info('AI service result', { result });
  return result;
}

module.exports = {
  chatWithAi,
};
