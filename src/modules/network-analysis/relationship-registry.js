'use strict';

/**
 * @type {Array<{from: string, to: string, resolverFn: function}>}
 */
const relationships = [];

/**
 * 
 * @param {string} from 
 * @param {string} to 
 * @param {function} resolverFn 
 */
function register(from, to, resolverFn) {
  relationships.push({ from, to, resolverFn });
}

/**
 * Get all registered relationship definitions for a node type
 * @param {string} nodeType 
 * @returns {Array<{from: string, to: string, resolverFn: function}>}
 */
function getRelationshipsFor(nodeType) {
  return relationships.filter(r => r.from === nodeType);
}

module.exports = {
  register,
  getRelationshipsFor,
  relationships
};
