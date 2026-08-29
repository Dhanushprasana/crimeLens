"use strict";

const { traverseGraph } = require("./graph-traverser");
const { initRegistry } = require("./registry-initializer");
const logger = require("../../config/logger");

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
    throw new Error("Root node id and type are required");
  }

  logger.info("[NetworkAnalysis:Service] Starting graph build", { root });

  const { nodes, edges } = await traverseGraph(req, root, filters);

  // Calculate Summary
  const summary = {
    criminals: 0,
    incidents: 0,
    vehicles: 0,
    aliases: 0,
    evidence: 0,
    districts: 0,
    policeStations: 0,
  };

  for (const node of nodes) {
    if (node.type === "criminal") summary.criminals++;
    if (node.type === "incident") summary.incidents++;
    if (node.type === "vehicle") summary.vehicles++;
    if (node.type === "alias") summary.aliases++;
    if (node.type === "evidence") summary.evidence++;
    if (node.type === "district") summary.districts++;
    if (node.type === "policeStation") summary.policeStations++;
  }

  logger.info("[NetworkAnalysis:Service] Graph complete", {
    root,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    summary,
  });

  return { summary, nodes, edges };
}

async function getGlobalNetworkGraph(req) {
  const env = require("../../config/env");
  logger.info("[NetworkAnalysis:Service] getGlobalNetworkGraph called");
  const zcql = req.catalyst ? req.catalyst.zcql() : null;
  if (!zcql) throw new Error("Catalyst not available");

  let level = req.query.level || "STATE";
  let nodeId = req.query.nodeId;

  // nodeType tells traverseGraph what entity nodeId refers to.
  // Valid values: 'incident' | 'criminal' | 'vehicle' | 'alias' | 'evidence'
  // Defaults to 'incident' for backward compatibility.
  const VALID_NODE_TYPES = new Set([
    "incident",
    "criminal",
    "vehicle",
    "alias",
    "evidence",
  ]);
  const nodeType =
    req.query.nodeType && VALID_NODE_TYPES.has(req.query.nodeType)
      ? req.query.nodeType
      : "incident";

  // Role comes from the JWT (trusted) — station/district IDs come from the frontend
  const userRole =
    req.user && req.user.role ? req.user.role : "STATE_COMMANDER";

  // Frontend must supply these based on the logged-in user's profile
  const frontendStationId = req.query.stationId; // required for STATION_COMMANDER / CASE_OFFICER
  const frontendDistrictId = req.query.districtId; // required for DISTRICT_COMMANDER

  // RBAC enforcement — role from JWT overrides the level; IDs from frontend
  if (userRole === "STATION_COMMANDER" || userRole === "CASE_OFFICER") {
    level = "STATION";
    if (!nodeId) nodeId = frontendStationId;
    if (!nodeId)
      throw Object.assign(new Error("stationId is required for this role"), {
        statusCode: 400,
      });
  } else if (userRole === "DISTRICT_COMMANDER") {
    if (level === "STATE") level = "DISTRICT";
    if (level === "DISTRICT" && !nodeId) {
      nodeId = frontendDistrictId;
      if (!nodeId)
        throw Object.assign(
          new Error("districtId is required for DISTRICT_COMMANDER"),
          { statusCode: 400 },
        );
    }
  } else {
    // STATE_COMMANDER or unknown roles: allow param-based level override
    if (frontendStationId && level === "STATE") {
      if (nodeId && nodeId !== frontendStationId) {
        // nodeId is explicitly provided and differs from stationId — it's a specific entity (incident, criminal, etc.)
        level = "NODE";
        // nodeId and nodeType stay as provided
      } else {
        level = "STATION";
        nodeId = nodeId || frontendStationId;
      }
    } else if (frontendDistrictId && level === "STATE") {
      level = "DISTRICT";
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
        drillDown: drillDown || null,
      });
      addedNodeIds.add(id);
    }
  };

  try {
    if (level === "STATE") {
      addNode("STATE", "State HQ", "STATE", null, null); // root node, no drill-down

      const distRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, district_name FROM ${env.TABLE_DISTRICT_GEODATA}`,
      );
      distRows.forEach((r) => {
        const row = r[env.TABLE_DISTRICT_GEODATA];
        addNode(
          `dist_${row.ROWID}`,
          row.district_name,
          "DISTRICT",
          row.ROWID,
          { level: "DISTRICT", nodeId: row.ROWID }, // click this to see stations inside
        );
        edges.push({
          id: `edge_state_${row.ROWID}`,
          source: "STATE",
          target: `dist_${row.ROWID}`,
          label: "has_district",
        });
      });
    } else if (level === "DISTRICT") {
      const targetDistrictId = nodeId || userDistrictId;
      if (!targetDistrictId)
        throw new Error("District ID is required for this level");

      // Fetch the district name
      const distInfo = await zcql.executeZCQLQuery(
        `SELECT ROWID, district_name FROM ${env.TABLE_DISTRICT_GEODATA} WHERE ROWID = '${targetDistrictId}'`,
      );
      const distLabel =
        distInfo && distInfo.length > 0
          ? distInfo[0][env.TABLE_DISTRICT_GEODATA].district_name
          : "District";
      addNode(
        `dist_${targetDistrictId}`,
        distLabel,
        "DISTRICT",
        targetDistrictId,
        null,
      ); // expanded already, no drill-down

      const stationRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, station_name FROM ${env.TABLE_POLICE_STATION} WHERE district_id = '${targetDistrictId}'`,
      );
      stationRows.forEach((r) => {
        const row = r[env.TABLE_POLICE_STATION];
        addNode(
          `station_${row.ROWID}`,
          row.station_name,
          "STATION",
          row.ROWID,
          { level: "STATION", nodeId: row.ROWID }, // click this to see deep crime network
        );
        edges.push({
          id: `edge_dist_${row.ROWID}`,
          source: `dist_${targetDistrictId}`,
          target: `station_${row.ROWID}`,
          label: "has_station",
        });
      });
    } else if (level === "STATION") {
      const targetStationId = nodeId;
      if (!targetStationId)
        throw Object.assign(
          new Error("nodeId (stationId) is required for STATION level"),
          { statusCode: 400 },
        );

      // Fetch the Police Station node
      const stationRes = await zcql.executeZCQLQuery(
        `SELECT ROWID, station_name FROM ${env.TABLE_POLICE_STATION} WHERE ROWID = '${targetStationId}'`,
      );
      if (stationRes && stationRes.length > 0) {
        addNode(
          `policeStation_${targetStationId}`,
          stationRes[0][env.TABLE_POLICE_STATION].station_name,
          "policeStation",
          targetStationId,
        );
      } else {
        addNode(
          `policeStation_${targetStationId}`,
          "Police Station",
          "policeStation",
          targetStationId,
        );
      }

      // Fetch crimes for this station
      const crimeRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, title FROM ${env.TABLE_CRIME_INCIDENT} WHERE police_station_id = '${targetStationId}' LIMIT 20`,
      );

      const { traverseGraph } = require("./graph-traverser");
      const edgeIds = new Set();

      // Fix B: Concurrency-limited traversal (3 at a time) to avoid saturating the
      // Catalyst ZCQL connection pool with 20 simultaneous BFS runs.
      const CONCURRENCY = 3;
      const traversalResults = [];

      for (let i = 0; i < crimeRows.length; i += CONCURRENCY) {
        const batch = crimeRows.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(
          batch.map(async (r) => {
            const crimeId = r[env.TABLE_CRIME_INCIDENT].ROWID;
            try {
              const deepGraph = await traverseGraph(
                req,
                { type: "incident", id: crimeId },
                {},
              );
              return { crimeId, deepGraph };
            } catch (err) {
              logger.error(
                "[NetworkAnalysis:Service] traverseGraph failed for incident",
                { crimeId, error: err.message },
              );
              return { crimeId, deepGraph: { nodes: [], edges: [] } };
            }
          }),
        );
        traversalResults.push(...batchResults);
      }

      // Merge all results, deduplicating by node/edge ID
      for (const { crimeId, deepGraph } of traversalResults) {
        // Add the station↔crime edge
        const stationEdgeId = `edge_incident_${crimeId}_REPORTED_AT_policeStation_${targetStationId}`;
        if (!edgeIds.has(stationEdgeId)) {
          edges.push({
            id: stationEdgeId,
            source: `incident_${crimeId}`,
            target: `policeStation_${targetStationId}`,
            relationship: "REPORTED_AT",
          });
          edgeIds.add(stationEdgeId);
        }

        deepGraph.nodes.forEach((n) => {
          if (!addedNodeIds.has(n.id)) {
            nodes.push(n);
            addedNodeIds.add(n.id);
          }
        });

        deepGraph.edges.forEach((e) => {
          if (!edgeIds.has(e.id)) {
            edges.push(e);
            edgeIds.add(e.id);
          }
        });
      }
    } else if (level === "NODE" || level === "CRIME") {
      // level 'CRIME' is kept as an alias for backward compatibility
      if (!nodeId) throw new Error("nodeId is required for NODE level");

      const { traverseGraph } = require("./graph-traverser");

      logger.info("[NetworkAnalysis:Service] NODE-level traversal", {
        nodeId,
        nodeType,
      });

      // BFS from the specified entity — nodeType tells us where to start
      const deepGraph = await traverseGraph(
        req,
        { type: nodeType, id: nodeId },
        {},
      );

      const nodeEdgeIds = new Set();
      deepGraph.nodes.forEach((n) => {
        if (!addedNodeIds.has(n.id)) {
          nodes.push(n);
          addedNodeIds.add(n.id);
        }
      });
      deepGraph.edges.forEach((e) => {
        if (!nodeEdgeIds.has(e.id)) {
          edges.push(e);
          nodeEdgeIds.add(e.id);
        }
      });
    }

    return { nodes, edges };
  } catch (err) {
    logger.error(
      "[NetworkAnalysis:Service] Error generating global graph",
      err,
    );
    throw err;
  }
}

async function getGlobalOptions(req) {
  const env = require("../../config/env");
  logger.info("[NetworkAnalysis:Service] getGlobalOptions called");
  const zcql = req.catalyst ? req.catalyst.zcql() : null;
  if (!zcql) throw new Error("Catalyst not available");

  // Role is trusted from JWT; station/district IDs come from frontend params
  const userRole =
    req.user && req.user.role ? req.user.role : "STATE_COMMANDER";
  const frontendStationId = req.query.stationId;
  const frontendDistrictId = req.query.districtId;

  const result = { districts: [], stations: [], crimes: [] };

  try {
    // STATE COMMANDER: Fetch all districts (no ID needed)
    if (userRole === "STATE_COMMANDER") {
      const distRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, district_name FROM ${env.TABLE_DISTRICT_GEODATA}`,
      );
      result.districts = distRows.map((r) => ({
        id: r[env.TABLE_DISTRICT_GEODATA].ROWID,
        name: r[env.TABLE_DISTRICT_GEODATA].district_name,
      }));
    }
    // DISTRICT COMMANDER: Frontend must supply districtId
    else if (userRole === "DISTRICT_COMMANDER") {
      if (!frontendDistrictId)
        throw Object.assign(
          new Error(
            "districtId query param is required for DISTRICT_COMMANDER",
          ),
          { statusCode: 400 },
        );

      const distRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, district_name FROM ${env.TABLE_DISTRICT_GEODATA} WHERE ROWID = '${frontendDistrictId}'`,
      );
      result.districts = distRows.map((r) => ({
        id: r[env.TABLE_DISTRICT_GEODATA].ROWID,
        name: r[env.TABLE_DISTRICT_GEODATA].district_name,
      }));

      const statRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, station_name FROM ${env.TABLE_POLICE_STATION} WHERE district_id = '${frontendDistrictId}'`,
      );
      result.stations = statRows.map((r) => ({
        id: r[env.TABLE_POLICE_STATION].ROWID,
        name: r[env.TABLE_POLICE_STATION].station_name,
      }));
    }
    // STATION COMMANDER: Frontend must supply stationId
    else if (userRole === "STATION_COMMANDER") {
      if (!frontendStationId)
        throw Object.assign(
          new Error("stationId query param is required for STATION_COMMANDER"),
          { statusCode: 400 },
        );

      const statRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, station_name FROM ${env.TABLE_POLICE_STATION} WHERE ROWID = '${frontendStationId}'`,
      );
      result.stations = statRows.map((r) => ({
        id: r[env.TABLE_POLICE_STATION].ROWID,
        name: r[env.TABLE_POLICE_STATION].station_name,
      }));

      const crimeRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, title FROM ${env.TABLE_CRIME_INCIDENT} WHERE police_station_id = '${frontendStationId}' LIMIT 50`,
      );
      result.crimes = crimeRows.map((r) => ({
        id: r[env.TABLE_CRIME_INCIDENT].ROWID,
        name: r[env.TABLE_CRIME_INCIDENT].title || "Incident",
      }));
    }

    return result;
  } catch (err) {
    logger.error(
      "[NetworkAnalysis:Service] Error generating global options",
      err,
    );
    throw err;
  }
}

async function getEntityOptions(req) {
  const env = require("../../config/env");
  logger.info("[NetworkAnalysis:Service] getEntityOptions called");
  const zcql = req.catalyst ? req.catalyst.zcql() : null;
  if (!zcql) throw new Error("Catalyst not available");

  const result = { criminals: [], suspects: [], vehicles: [], evidences: [] };

  try {
    const pickLabel = (row, fallbackPrefix) => {
      const raw = row || {};
      const candidate = [
        raw.evidence_type,
        raw.description,
        raw.evidence_number,
        raw.file_url,
        raw.registration_number,
        raw.full_name,
      ].find((value) => value && String(value).trim());

      if (candidate) return String(candidate).trim();
      if (raw.ROWID) return `${fallbackPrefix} #${raw.ROWID}`;
      return fallbackPrefix;
    };

    const crimRows = await zcql.executeZCQLQuery(
      `SELECT ROWID, full_name FROM ${env.TABLE_CRIMINAL} LIMIT 100`,
    );
    result.criminals = crimRows.map((r) => ({
      id: r[env.TABLE_CRIMINAL].ROWID,
      label: pickLabel(r[env.TABLE_CRIMINAL], "Criminal") || "Unknown Criminal",
      type: "criminal",
    }));

    const suspectRows = await zcql.executeZCQLQuery(
      `SELECT ROWID, full_name FROM ${env.TABLE_SUSPECT} LIMIT 100`,
    );
    result.suspects = suspectRows.map((r) => ({
      id: r[env.TABLE_SUSPECT].ROWID,
      label: pickLabel(r[env.TABLE_SUSPECT], "Suspect") || "Unknown Suspect",
      type: "suspect",
    }));

    const vehRows = await zcql.executeZCQLQuery(
      `SELECT ROWID, registration_number FROM ${env.TABLE_CRIMINAL_VEHICLE} LIMIT 100`,
    );
    result.vehicles = vehRows.map((r) => ({
      id: r[env.TABLE_CRIMINAL_VEHICLE].ROWID,
      label:
        pickLabel(r[env.TABLE_CRIMINAL_VEHICLE], "Vehicle") ||
        "Unknown Vehicle",
      type: "vehicle",
    }));

    const eviRows = await zcql.executeZCQLQuery(
      `SELECT ROWID, evidence_type, description, evidence_number, file_url FROM ${env.TABLE_CRIME_EVIDENCE} LIMIT 100`,
    );
    result.evidences = eviRows.map((r) => ({
      id: r[env.TABLE_CRIME_EVIDENCE].ROWID,
      label:
        pickLabel(r[env.TABLE_CRIME_EVIDENCE], "Evidence") ||
        "Unknown Evidence",
      type: "evidence",
    }));

    return result;
  } catch (err) {
    logger.error(
      "[NetworkAnalysis:Service] Error generating entity options",
      err,
    );
    throw err;
  }
}

module.exports = {
  buildNetworkGraph,
  getGlobalNetworkGraph,
  getGlobalOptions,
  getEntityOptions,
};
