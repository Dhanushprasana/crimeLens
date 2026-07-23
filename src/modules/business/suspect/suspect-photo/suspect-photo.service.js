'use strict';

const repository = require('./suspect-photo.repository');
const logger = require('../../../../config/logger');

module.exports = {
  async addSuspectPhoto(dto, req) {
    logger.info('addSuspectPhoto');
    if (!dto || !dto.photo_url) throw new Error('photo_url is required');
    if (!dto.suspect_id) throw new Error('suspect_id is required');
    return repository.addSuspectPhoto(dto, req);
  },
  async getPhotosBySuspect(suspectId, req) {
    logger.info(`getPhotosBySuspect ${suspectId}`);
    return repository.getPhotosBySuspect(suspectId, req);
  },
  async deleteSuspectPhoto(id, req) {
    logger.info(`deleteSuspectPhoto ${id}`);
    return repository.deleteSuspectPhoto(id, req);
  }
};
