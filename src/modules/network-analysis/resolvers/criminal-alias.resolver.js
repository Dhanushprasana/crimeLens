'use strict';

const { executeQuery } = require('./db-utils');
const env = require('../../../config/env');
const { criminal, alias } = require('../node-builder');
const { buildEdge } = require('../edge-builder');
const logger = require('../../../config/logger');

async function resolveCriminalAliases(req, criminalId, filters) {
  if (filters.alias === false) {
    logger.debug('[Resolver:CriminalAlias] Skipped — alias filter is off', { criminalId });
    return { nodes: [], edges: [] };
  }

  logger.debug('[Resolver:CriminalAlias] Fetching aliases for criminal', { criminalId });

  const query = `SELECT * FROM ${env.TABLE_CRIMINAL_ALIAS} WHERE criminal_id = '${criminalId}'`;
  const res = await executeQuery(req, query);

  if (!res || res.length === 0) {
    logger.debug('[Resolver:CriminalAlias] No aliases found', { criminalId });
    return { nodes: [], edges: [] };
  }

  const nodes = [];
  const edges = [];

  for (const row of res) {
    const aliasData = row[env.TABLE_CRIMINAL_ALIAS];
    nodes.push(alias(aliasData));
    edges.push(buildEdge(criminalId, 'criminal', aliasData.ROWID, 'alias', 'KNOWN_AS'));
    logger.debug('[Resolver:CriminalAlias] Resolved alias node', {
      criminalId,
      aliasId: aliasData.ROWID,
      aliasName: aliasData.alias_name
    });
  }

  logger.debug('[Resolver:CriminalAlias] Done', { criminalId, nodes: nodes.length, edges: edges.length });
  return { nodes, edges };
}

async function resolveAliasCriminals(req, aliasId, filters) {
  if (filters.criminal === false) {
    logger.debug('[Resolver:AliasCriminal] Skipped — criminal filter is off', { aliasId });
    return { nodes: [], edges: [] };
  }

  logger.debug('[Resolver:AliasCriminal] Fetching criminal for alias', { aliasId });

  const query = `SELECT * FROM ${env.TABLE_CRIMINAL_ALIAS} WHERE ROWID = '${aliasId}'`;
  const res = await executeQuery(req, query);

  if (!res || res.length === 0) {
    logger.debug('[Resolver:AliasCriminal] No alias record found', { aliasId });
    return { nodes: [], edges: [] };
  }

  const nodes = [];
  const edges = [];

  for (const row of res) {
    const criminalId = row[env.TABLE_CRIMINAL_ALIAS].criminal_id;
    if (!criminalId) {
      logger.warn('[Resolver:AliasCriminal] Alias has no linked criminal_id', { aliasId });
      continue;
    }

    const criminalQuery = `SELECT * FROM ${env.TABLE_CRIMINAL} WHERE ROWID = '${criminalId}'`;
    const criminalRes = await executeQuery(req, criminalQuery);

    if (criminalRes && criminalRes.length > 0) {
      const criminalData = criminalRes[0][env.TABLE_CRIMINAL];
      nodes.push(criminal(criminalData));
      edges.push(buildEdge(aliasId, 'alias', criminalId, 'criminal', 'KNOWN_AS'));
      logger.debug('[Resolver:AliasCriminal] Resolved criminal node', {
        aliasId,
        criminalId,
        label: criminalData.full_name
      });
    } else {
      logger.warn('[Resolver:AliasCriminal] Criminal record not found', { criminalId });
    }
  }

  logger.debug('[Resolver:AliasCriminal] Done', { aliasId, nodes: nodes.length, edges: edges.length });
  return { nodes, edges };
}
resolveAliasCriminals.loadNode = async (req, id) => {
  logger.debug('[Resolver:AliasCriminal] Loading alias root node', { id });
  const query = `SELECT * FROM ${env.TABLE_CRIMINAL_ALIAS} WHERE ROWID = '${id}'`;
  const res = await executeQuery(req, query);
  if (res && res.length > 0) return alias(res[0][env.TABLE_CRIMINAL_ALIAS]);
  logger.warn('[Resolver:AliasCriminal] Alias root node not found', { id });
  return null;
};

module.exports = { resolveCriminalAliases, resolveAliasCriminals };
