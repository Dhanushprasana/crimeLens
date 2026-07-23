'use strict';

const repository = require('./incident-officer.repository');
const logger = require('../../../../config/logger');

module.exports = {
  async assignOfficer(dto, req) {
    logger.info('assignOfficer');
    if (!dto || !dto.incident_id) throw new Error('incident_id is required');
    if (!dto.officer_id) throw new Error('officer_id is required');
    return repository.assignOfficer(dto, req);
  },
  async getOfficersByIncident(incidentId, req) {
    logger.info(`getOfficersByIncident ${incidentId}`);
    return repository.getOfficersByIncident(incidentId, req);
  },
  async getIncidentsByOfficer(officerId, req) {
    logger.info(`getIncidentsByOfficer ${officerId}`);
    return repository.getIncidentsByOfficer(officerId, req);
  },
  async removeOfficer(id, req) {
    logger.info(`removeOfficer ${id}`);
    return repository.removeOfficer(id, req);
  }
};
