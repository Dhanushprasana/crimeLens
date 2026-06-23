'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./role.controller');

// Create role
router.post('/', controller.createRole);

// Get all roles with pagination and optional detail query
router.get('/getAll', controller.findAllRoles);

// Get single role by ID
router.get('/getOneRole/:id', controller.findRoleById);

// Update role and its permissions
router.put('/:id', controller.updateRole);

// Soft delete role
router.delete('/:id', controller.softDeleteRole);

// Restore role
router.post('/:id/restore', controller.restoreRole);

// Create role with permissions
router.post('/permissions', controller.createRoleWithPermissions);

// Map permission names to a role
router.post('/:roleId/mapPermissions', controller.mapPermissionsToRole);

module.exports = router;
