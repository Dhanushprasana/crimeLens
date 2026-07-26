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

  // Aliases are stored directly on the alias table — single batch query
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

  // Step 1: Get the criminal_id from the alias record
  const aliasQuery = `SELECT criminal_id FROM ${env.TABLE_CRIMINAL_ALIAS} WHERE ROWID = '${aliasId}'`;
  const aliasRes = await executeQuery(req, aliasQuery);

  if (!aliasRes || aliasRes.length === 0) {
    logger.debug('[Resolver:AliasCriminal] No alias record found', { aliasId });
    return { nodes: [], edges: [] };
  }

  const criminalIds = aliasRes
    .map(r => r[env.TABLE_CRIMINAL_ALIAS]?.criminal_id)
    .filter(Boolean);

  if (criminalIds.length === 0) {
    logger.warn('[Resolver:AliasCriminal] Alias has no linked criminal_id', { aliasId });
    return { nodes: [], edges: [] };
  }

  // Step 2: Batch-fetch all criminals in a single query
  const idList = criminalIds.map(id => `'${id}'`).join(',');
  const batchQuery = `SELECT * FROM ${env.TABLE_CRIMINAL} WHERE ROWID IN (${idList})`;
  const criminalRes = await executeQuery(req, batchQuery);

  const nodes = [];
  const edges = [];

  if (criminalRes && criminalRes.length > 0) {
    for (const row of criminalRes) {
      const criminalData = row[env.TABLE_CRIMINAL];
      nodes.push(criminal(criminalData));
      edges.push(buildEdge(aliasId, 'alias', criminalData.ROWID, 'criminal', 'KNOWN_AS'));
      logger.debug('[Resolver:AliasCriminal] Resolved criminal node', {
        aliasId,
        criminalId: criminalData.ROWID,
        label: criminalData.full_name
      });
    }
  } else {
    logger.warn('[Resolver:AliasCriminal] Criminal record(s) not found', { criminalIds });
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
