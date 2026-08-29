"use strict";

const env = require("../../config/env");
const registry = require("./relationship-registry");
const { suspect } = require("./node-builder");

// Import all resolvers
const {
  resolveCriminalIncidents,
  resolveIncidentCriminals,
} = require("./resolvers/criminal-incident.resolver");
const {
  resolveCriminalVehicles,
  resolveVehicleCriminals,
} = require("./resolvers/criminal-vehicle.resolver");
const {
  resolveCriminalAliases,
  resolveAliasCriminals,
} = require("./resolvers/criminal-alias.resolver");
const {
  resolveIncidentEvidence,
  resolveEvidenceIncident,
} = require("./resolvers/incident-evidence.resolver");

const {
  resolveIncidentStation,
} = require("./resolvers/incident-station.resolver");

const resolveSuspectNoLinks = async () => ({ nodes: [], edges: [] });
resolveSuspectNoLinks.loadNode = async (req, id) => {
  const query = `SELECT * FROM ${env.TABLE_SUSPECT} WHERE ROWID = '${id}'`;
  const res = await req.catalyst.zcql().executeZCQLQuery(query);
  if (res && res.length > 0) return suspect(res[0][env.TABLE_SUSPECT]);
  return null;
};

// Register all bidirectional relationships
function initRegistry() {
  registry.register("criminal", "incident", resolveCriminalIncidents);
  registry.register("incident", "criminal", resolveIncidentCriminals);

  registry.register("criminal", "vehicle", resolveCriminalVehicles);
  registry.register("vehicle", "criminal", resolveVehicleCriminals);

  registry.register("criminal", "alias", resolveCriminalAliases);
  registry.register("alias", "criminal", resolveAliasCriminals);

  registry.register("incident", "evidence", resolveIncidentEvidence);
  // NOTE: evidence→incident is intentionally NOT registered.
  // Traversal always starts from station/incident. Resolving evidence back to its
  // parent incident produces only duplicate nodes and wastes N*2 DB queries.

  // Suspect root nodes are valid in the UI, but their direct graph edges are not yet
  // wired to specific relationship tables. We still keep the node and avoid a hard failure.
  registry.register("suspect", "incident", resolveSuspectNoLinks);

  // Unidirectional — prevent infinite cross-district loops
  registry.register("incident", "policeStation", resolveIncidentStation);
}

module.exports = { initRegistry };
