'use strict';

const logger = require('../../../config/logger');

async function resolveIncidentStation(req, sourceId, filters) {
  if (filters && filters.policeStation === false) return { nodes: [], edges: [] };
  
  const env = require('../../../config/env');
  const zcql = req.catalyst.zcql();

  const nodes = [];
  const edges = [];

  try {
    const incidentRes = await zcql.executeZCQLQuery(`SELECT police_station_id FROM ${env.TABLE_CRIME_INCIDENT} WHERE ROWID = '${sourceId}'`);
    if (incidentRes && incidentRes.length > 0 && incidentRes[0][env.TABLE_CRIME_INCIDENT].police_station_id) {
        const stationId = incidentRes[0][env.TABLE_CRIME_INCIDENT].police_station_id;
        const stationRes = await zcql.executeZCQLQuery(`SELECT ROWID, station_name FROM ${env.TABLE_POLICE_STATION} WHERE ROWID = '${stationId}'`);
        
        if (stationRes && stationRes.length > 0) {
            const row = stationRes[0][env.TABLE_POLICE_STATION];
            const stationKey = `policeStation_${row.ROWID}`;
            
            nodes.push({
                id: stationKey,
                type: 'policeStation',
                label: row.station_name,
                subtitle: 'Police Station',
                properties: {}
            });
            
            edges.push({
                id: `edge_incident_${sourceId}_REPORTED_AT_policeStation_${row.ROWID}`,
                source: `incident_${sourceId}`,
                target: stationKey,
                relationship: 'REPORTED_AT'
            });
        }
    }
    
    return { nodes, edges };
  } catch (err) {
    logger.error('[NetworkAnalysis:Resolver] incident -> policeStation failed', err);
    throw err;
  }
}

async function loadPoliceStationNode(req, id) {
  const env = require('../../../config/env');
  const zcql = req.catalyst.zcql();
  try {
    const stationRes = await zcql.executeZCQLQuery(`SELECT ROWID, station_name FROM ${env.TABLE_POLICE_STATION} WHERE ROWID = '${id}'`);
    if (stationRes && stationRes.length > 0) {
      const row = stationRes[0][env.TABLE_POLICE_STATION];
      return {
        id: `policeStation_${row.ROWID}`,
        type: 'policeStation',
        label: row.station_name,
        subtitle: 'Police Station',
        properties: {}
      };
    }
  } catch (err) {
    logger.error('[NetworkAnalysis:Resolver] Failed to load policeStation node', err);
  }
  return null;
}

// We only resolve ONE WAY (incident -> policeStation) inside traverseGraph to prevent infinite loops.
// We explicitly export loadPoliceStationNode so it can be manually called if needed, though 
// it's usually mapped inside the traverseGraph loop.
// Note: We MUST attach loadNode to the resolverFn as a property so traverseGraph can fetch root nodes!
resolveIncidentStation.loadNode = loadPoliceStationNode;

module.exports = { resolveIncidentStation, loadPoliceStationNode };
