'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./controller');

// Network Analysis Graph Endpoint
router.post('/network-analysis', controller.buildGraph);
router.get('/network-analysis/global', controller.getGlobalGraph);
router.get('/network-analysis/global/options', controller.getGlobalOptions);

module.exports = router;
