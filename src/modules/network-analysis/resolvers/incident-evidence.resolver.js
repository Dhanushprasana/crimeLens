'use strict';

const { executeQuery } = require('./db-utils');
const env = require('../../../config/env');
const { evidence, incident } = require('../node-builder');
const { buildEdge } = require('../edge-builder');
const logger = require('../../../config/logger');

async function resolveIncidentEvidence(req, incidentId, filters) {
  if (filters.evidence === false) {
    logger.debug('[Resolver:IncidentEvidence] Skipped — evidence filter is off', { incidentId });
    return { nodes: [], edges: [] };
  }

  logger.debug('[Resolver:IncidentEvidence] Fetching evidence for incident', { incidentId });

  // Single batch query — all evidence for this incident at once
  const query = `SELECT * FROM ${env.TABLE_CRIME_EVIDENCE} WHERE incident_id = '${incidentId}'`;
  const res = await executeQuery(req, query);

  if (!res || res.length === 0) {
    logger.debug('[Resolver:IncidentEvidence] No evidence found', { incidentId });
    return { nodes: [], edges: [] };
  }

  const nodes = [];
  const edges = [];

  for (const row of res) {
    const evidenceData = row[env.TABLE_CRIME_EVIDENCE];
    nodes.push(evidence(evidenceData));
    edges.push(buildEdge(incidentId, 'incident', evidenceData.ROWID, 'evidence', 'HAS_EVIDENCE'));
    logger.debug('[Resolver:IncidentEvidence] Resolved evidence node', {
      incidentId,
      evidenceId: evidenceData.ROWID,
      type: evidenceData.evidence_type
    });
  }

  logger.debug('[Resolver:IncidentEvidence] Done', { incidentId, nodes: nodes.length, edges: edges.length });
  return { nodes, edges };
}

async function resolveEvidenceIncident(req, evidenceId, filters) {
  if (filters.incident === false) {
    logger.debug('[Resolver:EvidenceIncident] Skipped — incident filter is off', { evidenceId });
    return { nodes: [], edges: [] };
  }

  logger.debug('[Resolver:EvidenceIncident] Fetching incident for evidence', { evidenceId });

  // Step 1: Get the incident_id from the evidence record
  const evidenceQuery = `SELECT incident_id FROM ${env.TABLE_CRIME_EVIDENCE} WHERE ROWID = '${evidenceId}'`;
  const evidenceRes = await executeQuery(req, evidenceQuery);

  if (!evidenceRes || evidenceRes.length === 0) {
    logger.debug('[Resolver:EvidenceIncident] No evidence record found', { evidenceId });
    return { nodes: [], edges: [] };
  }

  const incidentIds = evidenceRes
    .map(r => r[env.TABLE_CRIME_EVIDENCE]?.incident_id)
    .filter(Boolean);

  if (incidentIds.length === 0) {
    logger.warn('[Resolver:EvidenceIncident] Evidence has no linked incident_id', { evidenceId });
    return { nodes: [], edges: [] };
  }

  // Step 2: Batch-fetch all incidents in a single query
  const idList = incidentIds.map(id => `'${id}'`).join(',');
  const batchQuery = `SELECT * FROM ${env.TABLE_CRIME_INCIDENT} WHERE ROWID IN (${idList})`;
  const incidentRes = await executeQuery(req, batchQuery);

  const nodes = [];
  const edges = [];

  if (incidentRes && incidentRes.length > 0) {
    for (const row of incidentRes) {
      const incidentData = row[env.TABLE_CRIME_INCIDENT];
      nodes.push(incident(incidentData));
      edges.push(buildEdge(evidenceId, 'evidence', incidentData.ROWID, 'incident', 'HAS_EVIDENCE'));
      logger.debug('[Resolver:EvidenceIncident] Resolved incident node', {
        evidenceId,
        incidentId: incidentData.ROWID,
        label: incidentData.title
      });
    }
  } else {
    logger.warn('[Resolver:EvidenceIncident] Incident record(s) not found in biz_crime_incident', { incidentIds });
  }

  logger.debug('[Resolver:EvidenceIncident] Done', { evidenceId, nodes: nodes.length, edges: edges.length });
  return { nodes, edges };
}
resolveEvidenceIncident.loadNode = async (req, id) => {
  logger.debug('[Resolver:EvidenceIncident] Loading evidence root node', { id });
  const query = `SELECT * FROM ${env.TABLE_CRIME_EVIDENCE} WHERE ROWID = '${id}'`;
  const res = await executeQuery(req, query);
  if (res && res.length > 0) return evidence(res[0][env.TABLE_CRIME_EVIDENCE]);
  logger.warn('[Resolver:EvidenceIncident] Evidence root node not found', { id });
  return null;
};

module.exports = { resolveIncidentEvidence, resolveEvidenceIncident };
