'use strict';

const repository = require('./evidence-match.repository');
const logger     = require('../../../config/logger');
const { AppError } = require('../../../common/exceptions');

module.exports = {
  async create(body, req) {
    logger.info('EvidenceMatch.create');
    const { source_evidence_id, matched_evidence_id, evidence_type } = body;

    if (!source_evidence_id)  throw new AppError('source_evidence_id is required', 400);
    if (!matched_evidence_id) throw new AppError('matched_evidence_id is required', 400);
    if (!evidence_type)       throw new AppError('evidence_type is required', 400);

    return repository.create(body, req);
  },

  async getAll(req) {
    logger.info('EvidenceMatch.getAll');
    return repository.getAll(req);
  },

  async getById(id, req) {
    logger.info('EvidenceMatch.getById', { id });
    if (!id) throw new AppError('id is required', 400);
    const match = await repository.getById(id, req);
    if (!match) throw new AppError('Evidence match not found', 404);
    return match;
  },

  async getBySourceEvidence(sourceId, req) {
    logger.info('EvidenceMatch.getBySourceEvidence', { sourceId });
    if (!sourceId) throw new AppError('source_evidence_id is required', 400);
    return repository.getBySourceEvidence(sourceId, req);
  },

  async update(id, body, req) {
    logger.info('EvidenceMatch.update', { id });
    if (!id) throw new AppError('id is required', 400);
    // Ensure record exists before updating
    const existing = await repository.getById(id, req);
    if (!existing) throw new AppError('Evidence match not found', 404);
    return repository.update(id, body, req);
  },

  async remove(id, req) {
    logger.info('EvidenceMatch.remove', { id });
    if (!id) throw new AppError('id is required', 400);
    const existing = await repository.getById(id, req);
    if (!existing) throw new AppError('Evidence match not found', 404);
    return repository.remove(id, req);
  },
};
