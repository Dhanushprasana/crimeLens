'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./controller');

// Network Analysis Graph Endpoint
router.post('/network-analysis', controller.buildGraph);

module.exports = router;
