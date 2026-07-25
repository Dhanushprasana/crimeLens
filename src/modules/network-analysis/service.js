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

async function getGlobalNetworkGraph(req) {
  const env = require('../../config/env');
  logger.info('[NetworkAnalysis:Service] getGlobalNetworkGraph called');
  const zcql = req.catalyst ? req.catalyst.zcql() : null;
  if (!zcql) throw new Error('Catalyst not available');

  let level = req.query.level || 'STATE';
  let nodeId = req.query.nodeId;
  
  // Role comes from the JWT (trusted) — station/district IDs come from the frontend
  const userRole = req.user && req.user.role ? req.user.role : 'STATE_COMMANDER';

  // Frontend must supply these based on the logged-in user's profile
  const frontendStationId = req.query.stationId;   // required for STATION_COMMANDER / CASE_OFFICER
  const frontendDistrictId = req.query.districtId; // required for DISTRICT_COMMANDER

  // RBAC enforcement — role from JWT overrides the level; IDs from frontend
  if (userRole === 'STATION_COMMANDER' || userRole === 'CASE_OFFICER') {
    level = 'STATION';
    if (!nodeId) nodeId = frontendStationId;
    if (!nodeId) throw Object.assign(new Error('stationId is required for this role'), { statusCode: 400 });
  } else if (userRole === 'DISTRICT_COMMANDER') {
    if (level === 'STATE') level = 'DISTRICT';
    if (level === 'DISTRICT' && !nodeId) {
      nodeId = frontendDistrictId;
      if (!nodeId) throw Object.assign(new Error('districtId is required for DISTRICT_COMMANDER'), { statusCode: 400 });
    }
  } else {
    // STATE_COMMANDER or unknown roles: allow param-based level override
    // If a stationId or districtId is explicitly passed, respect it
    if (frontendStationId && level === 'STATE') {
      level = 'STATION';
      nodeId = nodeId || frontendStationId;
    } else if (frontendDistrictId && level === 'STATE') {
      level = 'DISTRICT';
      nodeId = nodeId || frontendDistrictId;
    }
  }


  const nodes = [];
  const edges = [];
  const addedNodeIds = new Set();

  const addNode = (id, label, type, rawId, drillDown = null) => {
     if (!addedNodeIds.has(id)) {
        nodes.push({
          id,
          label,
          type,
          rawId,
          canDrillDown: !!drillDown,
          drillDown: drillDown || null
        });
        addedNodeIds.add(id);
     }
  };

  try {
    if (level === 'STATE') {
      addNode('STATE', 'State HQ', 'STATE', null, null); // root node, no drill-down
      
      const distRows = await zcql.executeZCQLQuery(`SELECT ROWID, district_name FROM ${env.TABLE_DISTRICT_GEODATA}`);
      distRows.forEach(r => {
        const row = r[env.TABLE_DISTRICT_GEODATA];
        addNode(
          `dist_${row.ROWID}`,
          row.district_name,
          'DISTRICT',
          row.ROWID,
          { level: 'DISTRICT', nodeId: row.ROWID }  // click this to see stations inside
        );
        edges.push({ id: `edge_state_${row.ROWID}`, source: 'STATE', target: `dist_${row.ROWID}`, label: 'has_district' });
      });
    } 
    else if (level === 'DISTRICT') {
      const targetDistrictId = nodeId || userDistrictId;
      if (!targetDistrictId) throw new Error('District ID is required for this level');

      // Fetch the district name
      const distInfo = await zcql.executeZCQLQuery(`SELECT ROWID, district_name FROM ${env.TABLE_DISTRICT_GEODATA} WHERE ROWID = '${targetDistrictId}'`);
      const distLabel = distInfo && distInfo.length > 0 ? distInfo[0][env.TABLE_DISTRICT_GEODATA].district_name : 'District';
      addNode(`dist_${targetDistrictId}`, distLabel, 'DISTRICT', targetDistrictId, null); // expanded already, no drill-down

      const stationRows = await zcql.executeZCQLQuery(`SELECT ROWID, station_name FROM ${env.TABLE_POLICE_STATION} WHERE district_id = '${targetDistrictId}'`);
      stationRows.forEach(r => {
        const row = r[env.TABLE_POLICE_STATION];
        addNode(
          `station_${row.ROWID}`,
          row.station_name,
          'STATION',
          row.ROWID,
          { level: 'STATION', nodeId: row.ROWID }  // click this to see deep crime network
        );
        edges.push({ id: `edge_dist_${row.ROWID}`, source: `dist_${targetDistrictId}`, target: `station_${row.ROWID}`, label: 'has_station' });
      });
    }
    else if (level === 'STATION') {
      const targetStationId = nodeId;
      if (!targetStationId) throw Object.assign(new Error('nodeId (stationId) is required for STATION level'), { statusCode: 400 });

      // Fetch the Police Station node
      const stationRes = await zcql.executeZCQLQuery(`SELECT ROWID, station_name FROM ${env.TABLE_POLICE_STATION} WHERE ROWID = '${targetStationId}'`);
      if (stationRes && stationRes.length > 0) {
        addNode(`policeStation_${targetStationId}`, stationRes[0][env.TABLE_POLICE_STATION].station_name, 'policeStation', targetStationId);
      } else {
        addNode(`policeStation_${targetStationId}`, 'Police Station', 'policeStation', targetStationId);
      }

      // Fetch crimes for this station
      const crimeRows = await zcql.executeZCQLQuery(`SELECT ROWID, title FROM ${env.TABLE_CRIME_INCIDENT} WHERE police_station_id = '${targetStationId}' LIMIT 20`);
      
      const { traverseGraph } = require('./graph-traverser');
      const edgeIds = new Set();
      
      for (const r of crimeRows) {
        const crimeId = r[env.TABLE_CRIME_INCIDENT].ROWID;
        // The edge connecting station and crime
        const edgeId = `edge_incident_${crimeId}_REPORTED_AT_policeStation_${targetStationId}`;
        edges.push({ id: edgeId, source: `incident_${crimeId}`, target: `policeStation_${targetStationId}`, relationship: 'REPORTED_AT' });
        edgeIds.add(edgeId);
        
        // Deep traversal from each crime
        try {
          const deepGraph = await traverseGraph(req, { type: 'incident', id: crimeId }, { policeStation: true }); // ensure policeStation is resolved if found elsewhere
          
          deepGraph.nodes.forEach(n => {
            if (!addedNodeIds.has(n.id)) {
              nodes.push(n);
              addedNodeIds.add(n.id);
            }
          });
          
          deepGraph.edges.forEach(e => {
            if (!edgeIds.has(e.id)) {
              edges.push(e);
              edgeIds.add(e.id);
            }
          });
        } catch (err) {
          logger.error('[NetworkAnalysis:Service] traverseGraph failed for incident', { crimeId, error: err.message });
        }
      }
    }
    else if (level === 'CRIME') {
      if (!nodeId) throw new Error('Crime ID (nodeId) is required');
      addNode(`crime_${nodeId}`, 'Crime Incident', 'CRIME', nodeId);

      const criminalRows = await zcql.executeZCQLQuery(`SELECT ROWID, criminal_id FROM ${env.TABLE_INCIDENT_CRIMINAL} WHERE incident_id = '${nodeId}'`);
      
      for (const r of criminalRows) {
        const row = r[env.TABLE_INCIDENT_CRIMINAL];
        if (row.criminal_id) {
          try {
            const cRes = await zcql.executeZCQLQuery(`SELECT first_name, last_name FROM ${env.TABLE_CRIMINAL} WHERE ROWID = '${row.criminal_id}'`);
            const cName = cRes && cRes.length > 0 ? `${cRes[0][env.TABLE_CRIMINAL].first_name} ${cRes[0][env.TABLE_CRIMINAL].last_name}` : 'Unknown Criminal';
            
            addNode(`criminal_${row.criminal_id}`, cName.trim(), 'CRIMINAL', row.criminal_id);
            edges.push({ id: `edge_cr_crim_${row.criminal_id}`, source: `crime_${nodeId}`, target: `criminal_${row.criminal_id}`, label: 'involved_in' });
          } catch (e) {}
        }
      }
    }

    return { nodes, edges };
  } catch (err) {
    logger.error('[NetworkAnalysis:Service] Error generating global graph', err);
    throw err;
  }
}

async function getGlobalOptions(req) {
  const env = require('../../config/env');
  logger.info('[NetworkAnalysis:Service] getGlobalOptions called');
  const zcql = req.catalyst ? req.catalyst.zcql() : null;
  if (!zcql) throw new Error('Catalyst not available');

  // Role is trusted from JWT; station/district IDs come from frontend params
  const userRole = req.user && req.user.role ? req.user.role : 'STATE_COMMANDER';
  const frontendStationId  = req.query.stationId;
  const frontendDistrictId = req.query.districtId;

  const result = { districts: [], stations: [], crimes: [] };

  try {
    // STATE COMMANDER: Fetch all districts (no ID needed)
    if (userRole === 'STATE_COMMANDER') {
      const distRows = await zcql.executeZCQLQuery(`SELECT ROWID, district_name FROM ${env.TABLE_DISTRICT_GEODATA}`);
      result.districts = distRows.map(r => ({ id: r[env.TABLE_DISTRICT_GEODATA].ROWID, name: r[env.TABLE_DISTRICT_GEODATA].district_name }));
    } 
    // DISTRICT COMMANDER: Frontend must supply districtId
    else if (userRole === 'DISTRICT_COMMANDER') {
      if (!frontendDistrictId) throw Object.assign(new Error('districtId query param is required for DISTRICT_COMMANDER'), { statusCode: 400 });

      const distRows = await zcql.executeZCQLQuery(`SELECT ROWID, district_name FROM ${env.TABLE_DISTRICT_GEODATA} WHERE ROWID = '${frontendDistrictId}'`);
      result.districts = distRows.map(r => ({ id: r[env.TABLE_DISTRICT_GEODATA].ROWID, name: r[env.TABLE_DISTRICT_GEODATA].district_name }));

      const statRows = await zcql.executeZCQLQuery(`SELECT ROWID, station_name FROM ${env.TABLE_POLICE_STATION} WHERE district_id = '${frontendDistrictId}'`);
      result.stations = statRows.map(r => ({ id: r[env.TABLE_POLICE_STATION].ROWID, name: r[env.TABLE_POLICE_STATION].station_name }));
    } 
    // STATION COMMANDER: Frontend must supply stationId
    else if (userRole === 'STATION_COMMANDER') {
      if (!frontendStationId) throw Object.assign(new Error('stationId query param is required for STATION_COMMANDER'), { statusCode: 400 });

      const statRows = await zcql.executeZCQLQuery(`SELECT ROWID, station_name FROM ${env.TABLE_POLICE_STATION} WHERE ROWID = '${frontendStationId}'`);
      result.stations = statRows.map(r => ({ id: r[env.TABLE_POLICE_STATION].ROWID, name: r[env.TABLE_POLICE_STATION].station_name }));

      const crimeRows = await zcql.executeZCQLQuery(`SELECT ROWID, title FROM ${env.TABLE_CRIME_INCIDENT} WHERE police_station_id = '${frontendStationId}' LIMIT 50`);
      result.crimes = crimeRows.map(r => ({ id: r[env.TABLE_CRIME_INCIDENT].ROWID, name: r[env.TABLE_CRIME_INCIDENT].title || 'Incident' }));
    }

    return result;
  } catch (err) {
    logger.error('[NetworkAnalysis:Service] Error generating global options', err);
    throw err;
  }
}

module.exports = { buildNetworkGraph, getGlobalNetworkGraph, getGlobalOptions };
