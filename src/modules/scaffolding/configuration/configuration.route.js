'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./configuration.controller');

// Create/Update configuration
router.put('/', controller.upsertConfig);

// Get specific configuration by name
router.get('/:name', controller.getConfig);

// Get all configurations
router.get('/', controller.getAllConfigs);

// Update upload-path specifically
router.put('/upload-path', controller.updateUploadPath);

module.exports = router;
