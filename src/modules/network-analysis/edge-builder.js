'use strict';

/**
 * @typedef {Object} GraphEdge
 * @property {string} id
 * @property {string} source
 * @property {string} target
 * @property {string} relationship
 */

/**
 * 
 * @param {string} sourceId 
 * @param {string} sourceType 
 * @param {string} targetId 
 * @param {string} targetType 
 * @param {string} relationship 
 * @returns {GraphEdge}
 */
function buildEdge(sourceId, sourceType, targetId, targetType, relationship) {
  const sourceNodeId = `${sourceType}_${sourceId}`;
  const targetNodeId = `${targetType}_${targetId}`;
  
  // Sort to create a consistent edge ID regardless of direction
  const sortedNodes = [sourceNodeId, targetNodeId].sort();
  
  return {
    id: `edge_${sortedNodes[0]}_${relationship}_${sortedNodes[1]}`,
    source: sourceNodeId,
    target: targetNodeId,
    relationship
  };
}

module.exports = {
  buildEdge
};
