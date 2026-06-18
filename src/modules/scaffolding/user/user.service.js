'use strict';

const repository = require('./user.repository');
const logger = require('../../../config/logger');

module.exports = {
  async createUser(dto, req) {
    logger.info('createUser service called');
    if (!dto || !dto.email || !dto.password) {
      throw new Error('Email and Password are required');
    }
    return repository.createUser(dto, req);
  },

  async getAllUsers(query, req) {
    logger.info('getAllUsers service called');
    return repository.getAllUsers(query, req);
  },

  async restoreUser(id, req) {
    logger.info(`restoreUser service called for ID: ${id}`);
    return repository.restoreUser(id, req);
  },

  async getAllUsersV2(query, req) {
    logger.info('getAllUsersV2 service called');
    return repository.getAllUsersV2(query, req);
  },

  async updateUserRoleByEmail(dto, req) {
    logger.info(`updateUserRoleByEmail service called for email: ${dto?.email}`);
    if (!dto || !dto.email || !dto.roleName) {
      throw new Error('Email and roleName are required');
    }
    return repository.updateUserRoleByEmail(dto, req);
  },

  async deactivateUser(email, req) {
    logger.info(`deactivateUser service called for email: ${email}`);
    if (!email) {
      throw new Error('Email is required');
    }
    return repository.deactivateUser(email, req);
  },

  async activateUser(email, req) {
    logger.info(`activateUser service called for email: ${email}`);
    if (!email) {
      throw new Error('Email is required');
    }
    return repository.activateUser(email, req);
  },

  async hardDeleteUser(emails, req) {
    logger.info(`hardDeleteUser service called for emails: ${emails?.join(', ')}`);
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new Error('An array of emails is required');
    }
    return repository.hardDeleteUser(emails, req);
  }
};
