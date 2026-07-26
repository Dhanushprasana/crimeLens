'use strict';

const registry = require('./relationship-registry');

// Import all resolvers
const { resolveCriminalIncidents, resolveIncidentCriminals } = require('./resolvers/criminal-incident.resolver');
const { resolveCriminalVehicles, resolveVehicleCriminals } = require('./resolvers/criminal-vehicle.resolver');
const { resolveCriminalAliases, resolveAliasCriminals } = require('./resolvers/criminal-alias.resolver');
const { resolveIncidentEvidence, resolveEvidenceIncident } = require('./resolvers/incident-evidence.resolver');

const { resolveIncidentStation } = require('./resolvers/incident-station.resolver');

// Register all bidirectional relationships
function initRegistry() {
  registry.register('criminal', 'incident', resolveCriminalIncidents);
  registry.register('incident', 'criminal', resolveIncidentCriminals);
  
  registry.register('criminal', 'vehicle', resolveCriminalVehicles);
  registry.register('vehicle', 'criminal', resolveVehicleCriminals);
  
  registry.register('criminal', 'alias', resolveCriminalAliases);
  registry.register('alias', 'criminal', resolveAliasCriminals);
  
  registry.register('incident', 'evidence', resolveIncidentEvidence);
  // NOTE: evidence→incident is intentionally NOT registered.
  // Traversal always starts from station/incident. Resolving evidence back to its
  // parent incident produces only duplicate nodes and wastes N*2 DB queries.

  // Unidirectional — prevent infinite cross-district loops
  registry.register('incident', 'policeStation', resolveIncidentStation);
}

module.exports = { initRegistry };
