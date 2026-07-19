'use strict';

/**
 * @typedef {Object} GraphNode
 * @property {string} id
 * @property {string} type
 * @property {string} label
 * @property {string} subtitle
 * @property {Object} [properties]
 */

function buildNode(type, id, label, subtitle = '', properties = {}) {
  return {
    id: `${type}_${id}`,
    type,
    label: label || 'Unknown',
    subtitle: subtitle || '',
    properties
  };
}

function criminal(criminalData) {
  return buildNode('criminal', criminalData.ROWID, criminalData.full_name, criminalData.criminal_number, {
    status: criminalData.status,
    gender: criminalData.gender
  });
}

function incident(incidentData) {
  return buildNode(
    'incident',
    incidentData.ROWID,
    incidentData.title || `Incident #${incidentData.ROWID}`,
    incidentData.crime_number || incidentData.case_number || 'Crime Incident',
    {
      status: incidentData.status,
      date: incidentData.crime_occured_date_time,
      case_number: incidentData.case_number
    }
  );
}

function evidence(evidenceData) {
  return buildNode('evidence', evidenceData.ROWID, evidenceData.evidence_type, evidenceData.evidence_number, {
    description: evidenceData.description
  });
}

function vehicle(vehicleData) {
  return buildNode('vehicle', vehicleData.ROWID, vehicleData.registration_number, vehicleData.vehicle_type || 'Vehicle', {
    make: vehicleData.vehicle_make,
    model: vehicleData.vehicle_model
  });
}

function alias(aliasData) {
  return buildNode('alias', aliasData.ROWID, aliasData.alias_name, aliasData.alias_type || 'Alias', {});
}

function biometric(biometricData) {
  return buildNode('biometric', biometricData.ROWID, biometricData.biometric_type || 'Biometric', 'Biometric Record', {
    photo_url: biometricData.photo_url,
    fingerprint_url: biometricData.fingerprint_url,
    footprint_url: biometricData.footprint_url
  });
}

function district(districtData) {
  return buildNode('district', districtData.ROWID, districtData.district_name, 'District', {});
}

function policeStation(stationData) {
  return buildNode('policeStation', stationData.ROWID, stationData.station_name, 'Police Station', {
    stationCode: stationData.station_code
  });
}

module.exports = {
  buildNode,
  criminal,
  incident,
  evidence,
  vehicle,
  alias,
  biometric,
  district,
  policeStation
};
