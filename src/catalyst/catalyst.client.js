'use strict';

const catalyst = require('zcatalyst-sdk-node');

/**
 * Express middleware that initializes the Zoho Catalyst SDK
 * on every incoming request and attaches it to req.catalyst.
 */
module.exports = (req, res, next) => {
    try {
        req.catalyst = catalyst.initialize(req);
        next();
    } catch (err) {
        next(err);
    }
};
