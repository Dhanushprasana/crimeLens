'use strict';

const { traverseGraph } = require('./graph-traverser');
const { initRegistry } = require('./registry-initializer');
const logger = require('../../config/logger');

// Initialize the registry once
initRegistry();

/**
 * Generates a network graph starting from a root entity.
 * @param {Object} req - Express request
 * @param {Object} root - The starting node { id, type }
 * @param {Object} filters - Node & data filters
 */
async function buildNetworkGraph(req, root, filters) {
  if (!root || !root.id || !root.type) {
    throw new Error('Root node id and type are required');
  }

  logger.info('[NetworkAnalysis:Service] Starting graph build', { root });

  const { nodes, edges } = await traverseGraph(req, root, filters);

  // Calculate Summary
  const summary = {
    criminals: 0,
    incidents: 0,
    vehicles: 0,
    aliases: 0,
    evidence: 0,
    districts: 0,
    policeStations: 0
  };

  for (const node of nodes) {
    if (node.type === 'criminal') summary.criminals++;
    if (node.type === 'incident') summary.incidents++;
    if (node.type === 'vehicle') summary.vehicles++;
    if (node.type === 'alias') summary.aliases++;
    if (node.type === 'evidence') summary.evidence++;
    if (node.type === 'district') summary.districts++;
    if (node.type === 'policeStation') summary.policeStations++;
  }

  logger.info('[NetworkAnalysis:Service] Graph complete', {
    root,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    summary
  });

  return { summary, nodes, edges };
}

module.exports = { buildNetworkGraph };
