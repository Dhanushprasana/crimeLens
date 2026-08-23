'use strict';

const logger = require('../../../config/logger');
const crimeService = require('../../business/crime/crime.service');
const crimeCategoryService = require('../../business/crime-category/crime-category.service');
const districtService = require('../../business/geo-data/district.service');
const officerService = require('../../business/police/police-officer/police-officer.service');
const criminalService = require('../../business/criminal/criminal.service');
const criminalProfilingService = require('../../business/criminal-profiling/criminal-profiling.service');
const dashboardService = require('../../business/dashboard/dashboard.service');
const networkAnalysisService = require('../../network-analysis/service');
const { AppError } = require('../../../common/exceptions');
const { validateToolParams } = require('../schemas/ai.schemas');

function buildToolDefinition({ name, description, properties, required = [] }) {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      },
    },
  };
}

function getCrimeLookupToolDefinition() {
  return buildToolDefinition({
    name: 'get_crimes_for_district_year_range',
    description: 'Retrieves crime incidents for a district within a year range for CrimeLens reports.',
    properties: {
      districtName: {
        type: 'string',
        description: 'The district name to search, such as Bangalore Urban.',
      },
      fromYear: {
        type: 'string',
        description: 'Start year using a 4-digit year, example 2025.',
      },
      toYear: {
        type: 'string',
        description: 'End year using a 4-digit year, example 2026.',
      },
    },
    required: ['districtName', 'fromYear', 'toYear'],
  });
}

function getDistrictLookupToolDefinition() {
  return buildToolDefinition({
    name: 'get_district_by_name',
    description: 'Looks up a district by its full name and returns its row metadata.',
    properties: {
      districtName: {
        type: 'string',
        description: 'District name, for example Bangalore Urban or Mysore.',
      },
    },
    required: ['districtName'],
  });
}

function getCrimeCategoriesToolDefinition() {
  return buildToolDefinition({
    name: 'get_all_crime_categories',
    description: 'Returns the crime category master list used by CrimeLens.',
    properties: {},
    required: [],
  });
}

function getOfficersToolDefinition() {
  return buildToolDefinition({
    name: 'get_officers',
    description: 'Fetches police officers for a given query or filters.',
    properties: {
      page: { type: 'integer', description: 'Page number for pagination.' },
      pageSize: { type: 'integer', description: 'Number of officers per page.' },
      search: { type: 'string', description: 'Optional free text search.' },
    },
    required: [],
  });
}

function getCriminalByIdToolDefinition() {
  return buildToolDefinition({
    name: 'get_criminal_by_id',
    description: 'Returns the full record for a specific criminal by ROWID.',
    properties: {
      criminalId: { type: 'string', description: 'ROWID of the criminal record.' },
    },
    required: ['criminalId'],
  });
}

function getCriminalProfileToolDefinition() {
  return buildToolDefinition({
    name: 'generate_criminal_profile',
    description: 'Generates intelligence profile metrics for a criminal using incidents, behavior, associate, phone, and vehicle data.',
    properties: {
      criminalId: { type: 'string', description: 'ROWID of the criminal to profile.' },
    },
    required: ['criminalId'],
  });
}

function getDistrictStatsToolDefinition() {
  return buildToolDefinition({
    name: 'get_district_crime_stats',
    description: 'Returns crime counts aggregated by district and police station for a date range.',
    properties: {
      fromDate: { type: 'string', description: 'Start date in YYYY-MM-DD format.' },
      toDate: { type: 'string', description: 'End date in YYYY-MM-DD format.' },
      categoryId: { type: 'string', description: 'Optional category identifier filter.' },
    },
    required: ['fromDate', 'toDate'],
  });
}

function getNetworkGraphToolDefinition() {
  return buildToolDefinition({
    name: 'get_network_graph',
    description: 'Builds a network graph for a root entity such as a criminal, incident, or district.',
    properties: {
      rootType: { type: 'string', description: 'Entity type, such as criminal, incident, district, or policeStation.' },
      rootId: { type: 'string', description: 'ROWID of the root entity.' },
      level: { type: 'string', description: 'Optional graph scope: STATE, DISTRICT, STATION, or NODE.' },
    },
    required: ['rootType', 'rootId'],
  });
}

function getAvailableToolDefinitions() {
  return [
    getCrimeLookupToolDefinition(),
    getDistrictLookupToolDefinition(),
    getCrimeCategoriesToolDefinition(),
    getOfficersToolDefinition(),
    getCriminalByIdToolDefinition(),
    getCriminalProfileToolDefinition(),
    getDistrictStatsToolDefinition(),
    getNetworkGraphToolDefinition(),
  ];
}

async function executeCrimeLookupTool(params, req) {
  const validated = validateToolParams(params);

  const district = await districtService.getDistrictByName(validated.districtName, req);

  if (!district || !district.ROWID) {
    throw new AppError(`District not found: ${validated.districtName}`, 404);
  }

  const crimeQuery = {
    page: 1,
    pageSize: 100,
    districtId: district.ROWID,
    from: `${validated.fromYear}-01-01`,
    to: `${validated.toYear}-12-31`,
    sortBy: 'crime_occured_date_time',
    sortOrder: 'DESC',
  };

  const result = await crimeService.getAllCrimes(crimeQuery, req);

  const crimes = Array.isArray(result && result.data) ? result.data : [];
  return {
    district: district.district_name || validated.districtName,
    districtId: district.ROWID,
    dateRange: {
      from: `${validated.fromYear}-01-01`,
      to: `${validated.toYear}-12-31`,
    },
    totalRecords: result?.pagination?.totalRecords ?? crimes.length,
    crimes,
  };
}

async function executeDistrictLookupTool(params, req) {
  const districtName = String(params?.districtName || '').trim();
  if (!districtName) {
    throw new AppError('The district name is required.', 400);
  }

  const district = await districtService.getDistrictByName(districtName, req);
  if (!district || !district.ROWID) {
    throw new AppError(`District not found: ${districtName}`, 404);
  }

  return {
    district: district.district_name || districtName,
    districtId: district.ROWID,
    row: district,
  };
}

async function executeCrimeCategoriesTool(params, req) {
  const result = await crimeCategoryService.getAllCrimeCategories({}, req);
  return {
    totalRecords: Array.isArray(result) ? result.length : 0,
    categories: Array.isArray(result) ? result : [],
  };
}

async function executeOfficersTool(params, req) {
  const q = { ...(params || {}) };
  const result = await officerService.getAllOfficers(q, req);
  return {
    totalRecords: Array.isArray(result) ? result.length : 0,
    officers: Array.isArray(result) ? result : [],
  };
}

async function executeCriminalByIdTool(params, req) {
  const criminalId = String(params?.criminalId || '').trim();
  if (!criminalId) {
    throw new AppError('criminalId is required.', 400);
  }

  const result = await criminalService.getOneCriminal(criminalId, req);
  return { criminal: result };
}

async function executeCriminalProfileTool(params, req) {
  const criminalId = String(params?.criminalId || '').trim();
  if (!criminalId) {
    throw new AppError('criminalId is required.', 400);
  }

  const result = await criminalProfilingService.generateProfile(criminalId, req);
  return { profile: result };
}

async function executeDistrictStatsTool(params, req) {
  const query = {
    ...(params || {}),
    fromDate: params?.fromDate || params?.from || params?.startDate,
    toDate: params?.toDate || params?.to || params?.endDate,
  };

  const result = await dashboardService.getDistrictCrimeStats({ query, catalyst: req.catalyst });
  return result;
}

async function executeNetworkGraphTool(params, req) {
  const rootType = String(params?.rootType || '').trim();
  const rootId = String(params?.rootId || '').trim();
  if (!rootType || !rootId) {
    throw new AppError('rootType and rootId are required.', 400);
  }

  const root = { type: rootType, id: rootId };
  const level = params?.level || 'NODE';
  const filters = {};

  const result = await networkAnalysisService.buildNetworkGraph(req, root, filters);
  return {
    level,
    root,
    graph: result,
  };
}

async function executeToolCall(toolName, params, req) {
  switch (toolName) {
    case 'get_crimes_for_district_year_range':
      return executeCrimeLookupTool(params, req);
    case 'get_district_by_name':
      return executeDistrictLookupTool(params, req);
    case 'get_all_crime_categories':
      return executeCrimeCategoriesTool(params, req);
    case 'get_officers':
      return executeOfficersTool(params, req);
    case 'get_criminal_by_id':
      return executeCriminalByIdTool(params, req);
    case 'generate_criminal_profile':
      return executeCriminalProfileTool(params, req);
    case 'get_district_crime_stats':
      return executeDistrictStatsTool(params, req);
    case 'get_network_graph':
      return executeNetworkGraphTool(params, req);
    default:
      throw new AppError(`Unsupported tool: ${toolName}`, 400);
  }
}

module.exports = {
  getCrimeLookupToolDefinition,
  getDistrictLookupToolDefinition,
  getCrimeCategoriesToolDefinition,
  getOfficersToolDefinition,
  getCriminalByIdToolDefinition,
  getCriminalProfileToolDefinition,
  getDistrictStatsToolDefinition,
  getNetworkGraphToolDefinition,
  getAvailableToolDefinitions,
  executeCrimeLookupTool,
  executeDistrictLookupTool,
  executeCrimeCategoriesTool,
  executeOfficersTool,
  executeCriminalByIdTool,
  executeCriminalProfileTool,
  executeDistrictStatsTool,
  executeNetworkGraphTool,
  executeToolCall,
};
