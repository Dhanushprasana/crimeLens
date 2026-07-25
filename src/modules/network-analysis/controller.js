'use strict';

const networkAnalysisService = require('./service');
const logger = require('../../config/logger');

/**
 * Generates graph data for network analysis
 */
async function buildGraph(req, res) {
  const startTime = Date.now();
  const { root, filters } = req.body || {};

  logger.info('[NetworkAnalysis] Incoming request', {
    root,
    filterKeys: filters ? Object.keys(filters) : []
  });

  try {
    if (!root || !root.type || !root.id) {
      logger.warn('[NetworkAnalysis] Invalid request — missing root type or id', { body: req.body });
      return res.status(400).json({
        status: 'error',
        message: 'Valid root object with type and id is required'
      });
    }

    const defaultFilters = {
      criminal: true,
      incident: true,
      vehicle: true,
      alias: true,
      biometric: true,
      evidence: true,
      district: true,
      policeStation: true,
      matchedEvidence: true,
      ...filters
    };

    logger.debug('[NetworkAnalysis] Resolved filters', { filters: defaultFilters });

    const result = await networkAnalysisService.buildNetworkGraph(req, root, defaultFilters);

    const duration = Date.now() - startTime;
    logger.info('[NetworkAnalysis] Graph built successfully', {
      root,
      nodeCount: result.nodes.length,
      edgeCount: result.edges.length,
      summary: result.summary,
      durationMs: duration
    });

    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[NetworkAnalysis] Error generating network graph', {
      root,
      message: error.message,
      stack: error.stack,
      durationMs: duration
    });
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
}

async function getGlobalGraph(req, res) {
  const startTime = Date.now();
  logger.info('[NetworkAnalysis] Incoming global graph request', { query: req.query });

  try {
    const result = await networkAnalysisService.getGlobalNetworkGraph(req);

    const duration = Date.now() - startTime;
    logger.info('[NetworkAnalysis] Global graph built successfully', {
      nodeCount: result.nodes.length,
      edgeCount: result.edges.length,
      durationMs: duration
    });

    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[NetworkAnalysis] Error generating global network graph', {
      message: error.message,
      stack: error.stack,
      durationMs: duration
    });
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
}

async function getGlobalOptions(req, res) {
  try {
    const result = await networkAnalysisService.getGlobalOptions(req);
    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error('[NetworkAnalysis] Error generating global options', {
      message: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
}

module.exports = { buildGraph, getGlobalGraph, getGlobalOptions };
