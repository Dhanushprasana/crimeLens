'use strict';

const AI_NAVIGATION_TARGETS = Object.freeze({
  DASHBOARD: 'dashboard',

  CRIME_RECORDS: 'crime_records',
  OFFICER_RECORDS: 'officer_records',
  CRIMINAL_RECORDS: 'criminal_records',
  CRIMINAL_PROFILE: 'criminal_profile',

  ANALYTICS: 'crime_analytics',
  HEATMAP: 'crime_heatmap',
  NETWORK: 'network_analysis',
  RISK: 'risk_analysis',
  ALERTS: 'alerts',
  EFIR: 'efir',
  FORECAST: 'crime_forecast',
});

const AI_NAVIGATION_ROUTES = Object.freeze({
  [AI_NAVIGATION_TARGETS.DASHBOARD]: '/dashboard',

  [AI_NAVIGATION_TARGETS.CRIME_RECORDS]: '/entities/crimes',
  [AI_NAVIGATION_TARGETS.OFFICER_RECORDS]: '/entities/officers',
  [AI_NAVIGATION_TARGETS.CRIMINAL_RECORDS]: '/entities/criminals',
  [AI_NAVIGATION_TARGETS.CRIMINAL_PROFILE]: '/entities/criminals/:criminalId',

  [AI_NAVIGATION_TARGETS.ANALYTICS]: '/analytics',
  [AI_NAVIGATION_TARGETS.HEATMAP]: '/heatmap',
  [AI_NAVIGATION_TARGETS.NETWORK]: '/network',
  [AI_NAVIGATION_TARGETS.RISK]: '/risk',
  [AI_NAVIGATION_TARGETS.ALERTS]: '/alerts',
  [AI_NAVIGATION_TARGETS.EFIR]: '/efir',
  [AI_NAVIGATION_TARGETS.FORECAST]: '/forecast',
});

const AI_NAVIGATION_INTENTS = Object.freeze({
  CRIME_RECORDS: 'crime_records',
  OFFICER_RECORDS: 'officer_records',
  CRIMINAL_RECORDS: 'criminal_records',
  CRIMINAL_PROFILE: 'criminal_profile',

  CRIME_ANALYTICS: 'crime_analytics',
  CRIME_HEATMAP: 'crime_heatmap',
  CRIME_FORECAST: 'crime_forecast',

  RISK_ANALYSIS: 'risk_analysis',
  NETWORK_ANALYSIS: 'network_analysis',
  ALERTS: 'alerts',
});

const AI_FILTER_KEYS = Object.freeze({
  DISTRICT: 'district',
  DISTRICT_ID: 'districtId',
  CRIME_TYPES: 'crimeTypes',
  SEVERITIES: 'severities',
  SINGLE_DATE: 'singleDate',
  DATE_RANGE: 'dateRange',
  START_DATE: 'startDate',
  END_DATE: 'endDate',
  STATION_ID: 'stationId',
  POLICE_STATIONS: 'selectedPoliceStations',
  SYNDICATE: 'syndicateId',
  CRIME_CATEGORY: 'crimeCategory',
});

function isValidNavigationTarget(target) {
  return !!AI_NAVIGATION_ROUTES[target];
}

module.exports = {
  AI_NAVIGATION_TARGETS,
  AI_NAVIGATION_ROUTES,
  AI_NAVIGATION_INTENTS,
  AI_FILTER_KEYS,
  isValidNavigationTarget,
};
