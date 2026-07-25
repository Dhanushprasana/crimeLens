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
  registry.register('evidence', 'incident', resolveEvidenceIncident);

  // Unidirectional registry to prevent infinite cross-district loops
  registry.register('incident', 'policeStation', resolveIncidentStation);
}

module.exports = { initRegistry };
