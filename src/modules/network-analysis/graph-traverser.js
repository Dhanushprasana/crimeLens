'use strict';

const registry = require('./relationship-registry');
const logger = require('../../config/logger');

/**
 * Traverse the graph starting from a root node using BFS.
 * @param {Object} req - Express request object (for DB context/Catalyst)
 * @param {Object} rootNode - { id, type }
 * @param {Object} filters - Node/Data filters provided by user
 */
async function traverseGraph(req, rootNode, filters = {}) {
  const visitedNodes = new Set();
  const visitedEdges = new Set();
  const nodes = [];
  const edges = [];

  const queue = [rootNode];

  logger.debug('[NetworkAnalysis:Traverser] BFS started', {
    root: rootNode,
    activeFilters: Object.entries(filters)
      .filter(([, v]) => v !== true)
      .map(([k]) => k)
  });

  // Fetch and push the root node data
  async function fetchAndAddRootNode(current) {
    const rels = registry.getRelationshipsFor(current.type);
    if (rels.length === 0) {
      logger.warn('[NetworkAnalysis:Traverser] No relationships registered for root type', { type: current.type });
      return;
    }
    const rel = rels[0];
    if (typeof rel.resolverFn.loadNode === 'function') {
      logger.debug('[NetworkAnalysis:Traverser] Loading root node data', { type: current.type, id: current.id });
      const rootGraphNode = await rel.resolverFn.loadNode(req, current.id);
      if (rootGraphNode) {
        nodes.push(rootGraphNode);
        logger.debug('[NetworkAnalysis:Traverser] Root node loaded', { nodeId: rootGraphNode.id, label: rootGraphNode.label });
      } else {
        logger.warn('[NetworkAnalysis:Traverser] Root node not found in DB', { type: current.type, id: current.id });
      }
    }
  }

  let iterationCount = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    const nodeKey = `${current.type}_${current.id}`;
    iterationCount++;

    if (visitedNodes.has(nodeKey)) {
      logger.debug('[NetworkAnalysis:Traverser] Skipping already-visited node', { nodeKey });
      continue;
    }

    visitedNodes.add(nodeKey);
    logger.debug('[NetworkAnalysis:Traverser] Processing node', { nodeKey, queueLength: queue.length });

    // Fetch root node data on first iteration
    if (nodes.length === 0) {
      await fetchAndAddRootNode(current);
    }

    const relationships = registry.getRelationshipsFor(current.type);
    logger.debug('[NetworkAnalysis:Traverser] Relationships found for node type', {
      type: current.type,
      count: relationships.length,
      targets: relationships.map(r => r.to)
    });

    for (const rel of relationships) {
      // Check if this node type is filtered out
      if (filters[rel.to] === false) {
        logger.debug('[NetworkAnalysis:Traverser] Skipping filtered relationship', {
          from: rel.from,
          to: rel.to
        });
        continue;
      }

      logger.debug('[NetworkAnalysis:Traverser] Resolving relationship', {
        from: rel.from,
        to: rel.to,
        sourceId: current.id
      });

      let neighborNodes = [];
      let newEdges = [];

      try {
        const result = await rel.resolverFn(req, current.id, filters);
        neighborNodes = result.nodes;
        newEdges = result.edges;
      } catch (err) {
        logger.error('[NetworkAnalysis:Traverser] Resolver error', {
          from: rel.from,
          to: rel.to,
          sourceId: current.id,
          message: err.message
        });
        continue;
      }

      logger.debug('[NetworkAnalysis:Traverser] Resolver returned', {
        from: rel.from,
        to: rel.to,
        sourceId: current.id,
        newNodes: neighborNodes.length,
        newEdges: newEdges.length
      });

      // Deduplicate and add edges
      for (const edge of newEdges) {
        if (!visitedEdges.has(edge.id)) {
          visitedEdges.add(edge.id);
          edges.push(edge);
        } else {
          logger.debug('[NetworkAnalysis:Traverser] Duplicate edge skipped', { edgeId: edge.id });
        }
      }

      // Deduplicate and queue new neighbor nodes
      for (const neighbor of neighborNodes) {
        const neighborKey = `${neighbor.type}_${neighbor.id}`;

        if (!nodes.some(n => n.id === neighborKey)) {
          nodes.push(neighbor);
          logger.debug('[NetworkAnalysis:Traverser] New node added to graph', {
            nodeId: neighborKey,
            label: neighbor.label
          });
        } else {
          logger.debug('[NetworkAnalysis:Traverser] Duplicate node skipped', { nodeId: neighborKey });
        }

        if (!visitedNodes.has(neighborKey)) {
          const dbId = neighbor.id.replace(`${neighbor.type}_`, '');
          queue.push({ id: dbId, type: neighbor.type });
        }
      }
    }
  }

  logger.info('[NetworkAnalysis:Traverser] BFS complete', {
    root: rootNode,
    iterations: iterationCount,
    totalNodes: nodes.length,
    totalEdges: edges.length
  });

  return { nodes, edges };
}

module.exports = { traverseGraph };
