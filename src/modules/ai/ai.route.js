'use strict';

const express = require('express');
const controller = require('./ai.controller');

const router = express.Router();

router.post('/chat', controller.chat);

module.exports = router;
