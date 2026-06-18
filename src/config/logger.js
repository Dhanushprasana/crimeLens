'use strict';

const { NODE_ENV } = require('./env');

const LEVELS = { info: 'INFO', warn: 'WARN', error: 'ERROR', debug: 'DEBUG' };

function format(level, message, meta) {
    const ts = new Date().toISOString();
    const base = `[${ts}] [${level}] ${message}`;
    return meta ? `${base} ${JSON.stringify(meta)}` : base;
}

const logger = {
    info(message, meta) {
        console.log(format(LEVELS.info, message, meta));
    },
    warn(message, meta) {
        console.warn(format(LEVELS.warn, message, meta));
    },
    error(message, meta) {
        console.error(format(LEVELS.error, message, meta));
    },
    debug(message, meta) {
        if (NODE_ENV !== 'production') {
            console.log(format(LEVELS.debug, message, meta));
        }
    },
};

module.exports = logger;
