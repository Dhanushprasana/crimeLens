'use strict';

const { executeQuery } = require('./db-utils');
const env = require('../../../config/env');
const { criminal, vehicle } = require('../node-builder');
const { buildEdge } = require('../edge-builder');
const logger = require('../../../config/logger');

async function resolveCriminalVehicles(req, criminalId, filters) {
  if (filters.vehicle === false) {
    logger.debug('[Resolver:CriminalVehicle] Skipped — vehicle filter is off', { criminalId });
    return { nodes: [], edges: [] };
  }

  logger.debug('[Resolver:CriminalVehicle] Fetching vehicles for criminal', { criminalId });

  const query = `SELECT * FROM ${env.TABLE_CRIMINAL_VEHICLE} WHERE criminal_id = '${criminalId}'`;
  const res = await executeQuery(req, query);

  if (!res || res.length === 0) {
    logger.debug('[Resolver:CriminalVehicle] No vehicles found', { criminalId });
    return { nodes: [], edges: [] };
  }

  const nodes = [];
  const edges = [];

  for (const row of res) {
    const vehicleData = row[env.TABLE_CRIMINAL_VEHICLE];
    nodes.push(vehicle(vehicleData));
    edges.push(buildEdge(criminalId, 'criminal', vehicleData.ROWID, 'vehicle', 'USES'));
    logger.debug('[Resolver:CriminalVehicle] Resolved vehicle node', {
      criminalId,
      vehicleId: vehicleData.ROWID,
      registration: vehicleData.registration_number
    });
  }

  logger.debug('[Resolver:CriminalVehicle] Done', { criminalId, nodes: nodes.length, edges: edges.length });
  return { nodes, edges };
}

async function resolveVehicleCriminals(req, vehicleId, filters) {
  if (filters.criminal === false) {
    logger.debug('[Resolver:VehicleCriminal] Skipped — criminal filter is off', { vehicleId });
    return { nodes: [], edges: [] };
  }

  logger.debug('[Resolver:VehicleCriminal] Fetching criminal for vehicle', { vehicleId });

  const query = `SELECT * FROM ${env.TABLE_CRIMINAL_VEHICLE} WHERE ROWID = '${vehicleId}'`;
  const res = await executeQuery(req, query);

  if (!res || res.length === 0) {
    logger.debug('[Resolver:VehicleCriminal] No vehicle record found', { vehicleId });
    return { nodes: [], edges: [] };
  }

  const nodes = [];
  const edges = [];

  for (const row of res) {
    const criminalId = row[env.TABLE_CRIMINAL_VEHICLE].criminal_id;
    if (!criminalId) {
      logger.warn('[Resolver:VehicleCriminal] Vehicle has no linked criminal_id', { vehicleId });
      continue;
    }

    const criminalQuery = `SELECT * FROM ${env.TABLE_CRIMINAL} WHERE ROWID = '${criminalId}'`;
    const criminalRes = await executeQuery(req, criminalQuery);

    if (criminalRes && criminalRes.length > 0) {
      const criminalData = criminalRes[0][env.TABLE_CRIMINAL];
      nodes.push(criminal(criminalData));
      edges.push(buildEdge(vehicleId, 'vehicle', criminalId, 'criminal', 'USES'));
      logger.debug('[Resolver:VehicleCriminal] Resolved criminal node', {
        vehicleId,
        criminalId,
        label: criminalData.full_name
      });
    } else {
      logger.warn('[Resolver:VehicleCriminal] Criminal record not found', { criminalId });
    }
  }

  logger.debug('[Resolver:VehicleCriminal] Done', { vehicleId, nodes: nodes.length, edges: edges.length });
  return { nodes, edges };
}
resolveVehicleCriminals.loadNode = async (req, id) => {
  logger.debug('[Resolver:VehicleCriminal] Loading vehicle root node', { id });
  const query = `SELECT * FROM ${env.TABLE_CRIMINAL_VEHICLE} WHERE ROWID = '${id}'`;
  const res = await executeQuery(req, query);
  if (res && res.length > 0) return vehicle(res[0][env.TABLE_CRIMINAL_VEHICLE]);
  logger.warn('[Resolver:VehicleCriminal] Vehicle root node not found', { id });
  return null;
};

module.exports = { resolveCriminalVehicles, resolveVehicleCriminals };
