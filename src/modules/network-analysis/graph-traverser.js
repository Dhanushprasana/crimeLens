'use strict';

const registry = require('./relationship-registry');
const logger = require('../../config/logger');

/**
 * Traverse the graph starting from a root node using BFS.
 * @param {Object} req - Express request object (for DB context/Catalyst)
 * @param {Object} rootNode - { id, type }
 * @param {Object} filters - Node/Data filters provided by user
 * @param {number} [maxDepth=2] - Maximum BFS depth to prevent runaway expansion
 * @param {number} [maxNodes=200] - Hard cap on total nodes to prevent runaway graphs
 */
async function traverseGraph(req, rootNode, filters = {}, maxDepth = 2, maxNodes = 200) {
  const visitedNodes = new Set();
  const visitedEdges = new Set();
  // O(1) Set-based node deduplication
  const addedNodeIds = new Set();
  const nodes = [];
  const edges = [];

  // Track depth per queue entry { node, depth }
  const queue = [{ node: rootNode, depth: 0 }];

  logger.debug('[NetworkAnalysis:Traverser] BFS started', {
    root: rootNode,
    maxDepth,
    maxNodes,
    activeFilters: Object.keys(filters).filter(k => filters[k] === false)
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
        const rootKey = `${rootGraphNode.type}_${rootGraphNode.id}`;
        if (!addedNodeIds.has(rootKey)) {
          nodes.push(rootGraphNode);
          addedNodeIds.add(rootKey);
        }
        logger.debug('[NetworkAnalysis:Traverser] Root node loaded', { nodeId: rootGraphNode.id, label: rootGraphNode.label });
      } else {
        logger.warn('[NetworkAnalysis:Traverser] Root node not found in DB', { type: current.type, id: current.id });
      }
    }
  }

  let iterationCount = 0;

  while (queue.length > 0) {
    const { node: current, depth } = queue.shift();
    const nodeKey = `${current.type}_${current.id}`;
    iterationCount++;

    if (visitedNodes.has(nodeKey)) {
      logger.debug('[NetworkAnalysis:Traverser] Skipping already-visited node', { nodeKey });
      continue;
    }

    visitedNodes.add(nodeKey);
    logger.debug('[NetworkAnalysis:Traverser] Processing node', { nodeKey, depth, queueLength: queue.length });

    // Fetch root node data on first iteration
    if (nodes.length === 0) {
      await fetchAndAddRootNode(current);
    }

    // Stop expanding neighbors beyond maxDepth
    if (depth >= maxDepth) {
      logger.debug('[NetworkAnalysis:Traverser] Max depth reached, not expanding further', { nodeKey, depth, maxDepth });
      continue;
    }

    // Hard cap: stop adding to the graph if maxNodes is reached
    if (nodes.length >= maxNodes) {
      logger.warn('[NetworkAnalysis:Traverser] Max nodes limit reached, halting BFS', { maxNodes, totalNodes: nodes.length });
      break;
    }

    const relationships = registry.getRelationshipsFor(current.type);
    logger.debug('[NetworkAnalysis:Traverser] Relationships found for node type', {
      type: current.type,
      count: relationships.length,
      targets: relationships.map(r => r.to)
    });

    // Filter out skipped relationship types
    const activeRels = relationships.filter(rel => filters[rel.to] !== false);

    // Fix C: Resolve all relationships for this node in parallel
    const resolverResults = await Promise.all(
      activeRels.map(async (rel) => {
        logger.debug('[NetworkAnalysis:Traverser] Resolving relationship', {
          from: rel.from,
          to: rel.to,
          sourceId: current.id
        });
        try {
          const result = await rel.resolverFn(req, current.id, filters);
          logger.debug('[NetworkAnalysis:Traverser] Resolver returned', {
            from: rel.from,
            to: rel.to,
            sourceId: current.id,
            newNodes: result.nodes.length,
            newEdges: result.edges.length
          });
          return result;
        } catch (err) {
          logger.error('[NetworkAnalysis:Traverser] Resolver error', {
            from: rel.from,
            to: rel.to,
            sourceId: current.id,
            message: err.message
          });
          return { nodes: [], edges: [] };
        }
      })
    );

    // Merge all resolver results
    for (const { nodes: neighborNodes, edges: newEdges } of resolverResults) {
      // Deduplicate and add edges
      for (const edge of newEdges) {
        if (!visitedEdges.has(edge.id)) {
          visitedEdges.add(edge.id);
          edges.push(edge);
        } else {
          logger.debug('[NetworkAnalysis:Traverser] Duplicate edge skipped', { edgeId: edge.id });
        }
      }

      // O(1) Set-based dedup + enqueue with incremented depth
      for (const neighbor of neighborNodes) {
        const neighborKey = `${neighbor.type}_${neighbor.id}`;

        if (!addedNodeIds.has(neighborKey)) {
          nodes.push(neighbor);
          addedNodeIds.add(neighborKey);
          logger.debug('[NetworkAnalysis:Traverser] New node added to graph', {
            nodeId: neighborKey,
            label: neighbor.label
          });
        } else {
          logger.debug('[NetworkAnalysis:Traverser] Duplicate node skipped', { nodeId: neighborKey });
        }

        if (!visitedNodes.has(neighborKey)) {
          const dbId = neighbor.id.replace(`${neighbor.type}_`, '');
          queue.push({ node: { id: dbId, type: neighbor.type }, depth: depth + 1 });
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
