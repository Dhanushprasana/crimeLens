'use strict';

const express = require('express');
const controller = require('./report.controller');

const router = express.Router();

// Example: GET /reports?entity=crime&id=123456789
router.get('/', controller.downloadReport);

module.exports = router;
