'use strict';

const repository = require('./case-witness.repository');
const logger = require('../../../../config/logger');

module.exports = {
  async addWitness(dto, req) {
    logger.info('addWitness');
    if (!dto || !dto.incident_id) throw new Error('incident_id is required');
    if (!dto.full_name) throw new Error('full_name is required');
    return repository.addWitness(dto, req);
  },
  async getWitnessesByIncident(incidentId, req) {
    logger.info(`getWitnessesByIncident ${incidentId}`);
    return repository.getWitnessesByIncident(incidentId, req);
  },
  async getOneWitness(id, req) {
    logger.info(`getOneWitness ${id}`);
    return repository.getOneWitness(id, req);
  },
  async updateWitness(id, dto, req) {
    logger.info(`updateWitness ${id}`);
    return repository.updateWitness(id, dto, req);
  },
  async deleteWitness(id, req) {
    logger.info(`deleteWitness ${id}`);
    return repository.deleteWitness(id, req);
  }
};
