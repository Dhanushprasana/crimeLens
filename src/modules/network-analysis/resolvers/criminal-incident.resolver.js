'use strict';

const { executeQuery } = require('./db-utils');
const env = require('../../../config/env');
const { criminal, incident } = require('../node-builder');
const { buildEdge } = require('../edge-builder');
const logger = require('../../../config/logger');

async function resolveCriminalIncidents(req, criminalId, filters) {
  if (filters.incident === false) {
    logger.debug('[Resolver:CriminalIncident] Skipped — incident filter is off', { criminalId });
    return { nodes: [], edges: [] };
  }

  logger.debug('[Resolver:CriminalIncident] Fetching incidents for criminal', { criminalId });

  // Step 1: Get all incident IDs from the junction table in one query
  const junctionQuery = `SELECT incident_id FROM ${env.TABLE_INCIDENT_CRIMINAL} WHERE criminal_id = '${criminalId}'`;
  const junctionRes = await executeQuery(req, junctionQuery);

  if (!junctionRes || junctionRes.length === 0) {
    logger.debug('[Resolver:CriminalIncident] No incident links found', { criminalId });
    return { nodes: [], edges: [] };
  }

  const incidentIds = junctionRes
    .map(r => r[env.TABLE_INCIDENT_CRIMINAL]?.incident_id)
    .filter(Boolean);

  if (incidentIds.length === 0) return { nodes: [], edges: [] };

  logger.debug('[Resolver:CriminalIncident] Incident links found', { criminalId, count: incidentIds.length });

  // Step 2: Batch-fetch all incidents in a single query using IN clause
  const idList = incidentIds.map(id => `'${id}'`).join(',');
  const batchQuery = `SELECT * FROM ${env.TABLE_CRIME_INCIDENT} WHERE ROWID IN (${idList})`;
  const incidentRes = await executeQuery(req, batchQuery);

  const nodes = [];
  const edges = [];

  if (incidentRes && incidentRes.length > 0) {
    for (const row of incidentRes) {
      const incidentData = row[env.TABLE_CRIME_INCIDENT];
      nodes.push(incident(incidentData));
      edges.push(buildEdge(criminalId, 'criminal', incidentData.ROWID, 'incident', 'INVOLVED_IN'));
      logger.debug('[Resolver:CriminalIncident] Resolved incident node', {
        criminalId,
        incidentId: incidentData.ROWID,
        label: incidentData.title
      });
    }
  }

  logger.debug('[Resolver:CriminalIncident] Done', { criminalId, nodes: nodes.length, edges: edges.length });
  return { nodes, edges };
}
resolveCriminalIncidents.loadNode = async (req, id) => {
  logger.debug('[Resolver:CriminalIncident] Loading criminal root node', { id });
  const query = `SELECT * FROM ${env.TABLE_CRIMINAL} WHERE ROWID = '${id}'`;
  const res = await executeQuery(req, query);
  if (res && res.length > 0) return criminal(res[0][env.TABLE_CRIMINAL]);
  logger.warn('[Resolver:CriminalIncident] Criminal root node not found', { id });
  return null;
};

async function resolveIncidentCriminals(req, incidentId, filters) {
  if (filters.criminal === false) {
    logger.debug('[Resolver:IncidentCriminal] Skipped — criminal filter is off', { incidentId });
    return { nodes: [], edges: [] };
  }

  logger.debug('[Resolver:IncidentCriminal] Fetching criminals for incident', { incidentId });

  // Step 1: Get all criminal IDs from the junction table in one query
  const junctionQuery = `SELECT criminal_id FROM ${env.TABLE_INCIDENT_CRIMINAL} WHERE incident_id = '${incidentId}'`;
  const junctionRes = await executeQuery(req, junctionQuery);

  if (!junctionRes || junctionRes.length === 0) {
    logger.debug('[Resolver:IncidentCriminal] No criminal links found', { incidentId });
    return { nodes: [], edges: [] };
  }

  const criminalIds = junctionRes
    .map(r => r[env.TABLE_INCIDENT_CRIMINAL]?.criminal_id)
    .filter(Boolean);

  if (criminalIds.length === 0) return { nodes: [], edges: [] };

  logger.debug('[Resolver:IncidentCriminal] Criminal links found', { incidentId, count: criminalIds.length });

  // Step 2: Batch-fetch all criminals in a single query using IN clause
  const idList = criminalIds.map(id => `'${id}'`).join(',');
  const batchQuery = `SELECT * FROM ${env.TABLE_CRIMINAL} WHERE ROWID IN (${idList})`;
  const criminalRes = await executeQuery(req, batchQuery);

  const nodes = [];
  const edges = [];

  if (criminalRes && criminalRes.length > 0) {
    for (const row of criminalRes) {
      const criminalData = row[env.TABLE_CRIMINAL];
      nodes.push(criminal(criminalData));
      edges.push(buildEdge(incidentId, 'incident', criminalData.ROWID, 'criminal', 'INVOLVED_IN'));
      logger.debug('[Resolver:IncidentCriminal] Resolved criminal node', {
        incidentId,
        criminalId: criminalData.ROWID,
        label: criminalData.full_name
      });
    }
  }

  logger.debug('[Resolver:IncidentCriminal] Done', { incidentId, nodes: nodes.length, edges: edges.length });
  return { nodes, edges };
}
resolveIncidentCriminals.loadNode = async (req, id) => {
  logger.debug('[Resolver:IncidentCriminal] Loading incident root node', { id });
  const query = `SELECT * FROM ${env.TABLE_CRIME_INCIDENT} WHERE ROWID = '${id}'`;
  const res = await executeQuery(req, query);
  if (res && res.length > 0) return incident(res[0][env.TABLE_CRIME_INCIDENT]);
  logger.warn('[Resolver:IncidentCriminal] Incident root node not found', { id });
  return null;
};

module.exports = { resolveCriminalIncidents, resolveIncidentCriminals };
