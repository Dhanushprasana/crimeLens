'use strict';

const repository = require('./case-victim.repository');
const logger = require('../../../../config/logger');

module.exports = {
  async addVictim(dto, req) {
    logger.info('addVictim');
    if (!dto || !dto.incident_id) throw new Error('incident_id is required');
    if (!dto.full_name) throw new Error('full_name is required');
    return repository.addVictim(dto, req);
  },
  async getVictimsByIncident(incidentId, req) {
    logger.info(`getVictimsByIncident ${incidentId}`);
    return repository.getVictimsByIncident(incidentId, req);
  },
  async getOneVictim(id, req) {
    logger.info(`getOneVictim ${id}`);
    return repository.getOneVictim(id, req);
  },
  async updateVictim(id, dto, req) {
    logger.info(`updateVictim ${id}`);
    return repository.updateVictim(id, dto, req);
  },
  async deleteVictim(id, req) {
    logger.info(`deleteVictim ${id}`);
    return repository.deleteVictim(id, req);
  }
};
