'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./user.controller');

// Create user
router.post('/', controller.createUser);

// Hard delete user
router.delete('/', controller.deleteUser);

// Get all users
router.get('/getAll', controller.getAllUsers);

// Restore deleted user
router.post('/:id/restore', controller.restoreUser);

// Get all users V2 (invites & requests)
router.get('/getAllUsers', controller.getAllUsersV2);

// Update user role
router.put('/role', controller.updateUserRole);

// Deactivate user
router.patch('/deactivate/:email', controller.deactivateUser);

// Activate user
router.patch('/activate/:email', controller.activateUser);

module.exports = router;
