'use strict';

const express = require('express');
const controller = require('./ai.controller');
const optionalAuth = require('../../middleware/optionalAuth.middleware');

const router = express.Router();

// Use optional auth so bearer tokens (when provided) populate `req.user`.
router.post('/chat', optionalAuth, controller.chat);

module.exports = router;
