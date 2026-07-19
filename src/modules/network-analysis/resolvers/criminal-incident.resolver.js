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

  const query = `SELECT * FROM ${env.TABLE_INCIDENT_CRIMINAL} WHERE criminal_id = '${criminalId}'`;
  const res = await executeQuery(req, query);

  if (!res || res.length === 0) {
    logger.debug('[Resolver:CriminalIncident] No incident links found', { criminalId });
    return { nodes: [], edges: [] };
  }

  logger.debug('[Resolver:CriminalIncident] Incident links found', { criminalId, count: res.length });

  const nodes = [];
  const edges = [];

  for (const row of res) {
    const incidentId = row[env.TABLE_INCIDENT_CRIMINAL].incident_id;

    const incidentQuery = `SELECT * FROM ${env.TABLE_CRIME_INCIDENT} WHERE ROWID = '${incidentId}'`;
    const incidentRes = await executeQuery(req, incidentQuery);

    if (incidentRes && incidentRes.length > 0) {
      const incidentData = incidentRes[0][env.TABLE_CRIME_INCIDENT];
      nodes.push(incident(incidentData));
      edges.push(buildEdge(criminalId, 'criminal', incidentId, 'incident', 'INVOLVED_IN'));
      logger.debug('[Resolver:CriminalIncident] Resolved incident node', {
        criminalId,
        incidentId,
        label: incidentData.title
      });
    } else {
      logger.warn('[Resolver:CriminalIncident] Incident record not found in biz_crime_incident', { incidentId });
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

  const query = `SELECT * FROM ${env.TABLE_INCIDENT_CRIMINAL} WHERE incident_id = '${incidentId}'`;
  const res = await executeQuery(req, query);

  if (!res || res.length === 0) {
    logger.debug('[Resolver:IncidentCriminal] No criminal links found', { incidentId });
    return { nodes: [], edges: [] };
  }

  logger.debug('[Resolver:IncidentCriminal] Criminal links found', { incidentId, count: res.length });

  const nodes = [];
  const edges = [];

  for (const row of res) {
    const criminalId = row[env.TABLE_INCIDENT_CRIMINAL].criminal_id;

    const criminalQuery = `SELECT * FROM ${env.TABLE_CRIMINAL} WHERE ROWID = '${criminalId}'`;
    const criminalRes = await executeQuery(req, criminalQuery);

    if (criminalRes && criminalRes.length > 0) {
      const criminalData = criminalRes[0][env.TABLE_CRIMINAL];
      nodes.push(criminal(criminalData));
      edges.push(buildEdge(incidentId, 'incident', criminalId, 'criminal', 'INVOLVED_IN'));
      logger.debug('[Resolver:IncidentCriminal] Resolved criminal node', {
        incidentId,
        criminalId,
        label: criminalData.full_name
      });
    } else {
      logger.warn('[Resolver:IncidentCriminal] Criminal record not found in biz_criminal', { criminalId });
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
