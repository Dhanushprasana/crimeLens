'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./permission.controller');

// Create permissions (bulk)
router.post('/', controller.createPermission);

// Find all permissions
router.get('/', controller.findAll);

// Update permission by ID
router.put('/:id', controller.updatePermission);

// Soft delete permission
router.delete('/:id', controller.softDeletePermission);

// Restore permission
router.post('/:id/restore', controller.restorePermission);

// Hard delete permission
router.delete('/:id/hard', controller.hardDeletePermission);

module.exports = router;
