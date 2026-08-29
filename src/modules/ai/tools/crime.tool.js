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
const authService = require('../../auth/auth.service');

const { AppError } = require('../../../common/exceptions');
const { validateToolParams } = require('../schemas/ai.schemas');

function buildToolDefinition({
  name,
  description,
  properties,
  required = [],
}) {
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

/* -------------------------------------------------------------------------- */
/* Existing tool definitions                                                  */
/* -------------------------------------------------------------------------- */

function getCrimeLookupToolDefinition() {
  return buildToolDefinition({
    name: 'get_crimes_for_district_year_range',
    description:
      'Retrieves crime incidents for a district within a year range for CrimeLens reports.',
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
    description:
      'Looks up a district by its full name and returns its row metadata.',
    properties: {
      districtName: {
        type: 'string',
        description:
          'District name, for example Bangalore Urban or Mysore.',
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
      page: {
        type: 'integer',
        description: 'Page number for pagination.',
      },
      pageSize: {
        type: 'integer',
        description: 'Number of officers per page.',
      },
      search: {
        type: 'string',
        description: 'Optional free text search.',
      },
    },
    required: [],
  });
}

function getCriminalByIdToolDefinition() {
  return buildToolDefinition({
    name: 'get_criminal_by_id',
    description: 'Returns the full record for a specific criminal by ROWID.',
    properties: {
      criminalId: {
        type: 'string',
        description: 'ROWID of the criminal record.',
      },
    },
    required: ['criminalId'],
  });
}

function getCriminalProfileToolDefinition() {
  return buildToolDefinition({
    name: 'generate_criminal_profile',
    description:
      'Generates intelligence profile metrics for a criminal using incidents, behavior, associate, phone, and vehicle data.',
    properties: {
      criminalId: {
        type: 'string',
        description: 'ROWID of the criminal to profile.',
      },
    },
    required: ['criminalId'],
  });
}

function getDistrictStatsToolDefinition() {
  return buildToolDefinition({
    name: 'get_district_crime_stats',
    description:
      'Returns crime counts aggregated by district and police station for a date range.',
    properties: {
      fromDate: {
        type: 'string',
        description: 'Start date in YYYY-MM-DD format.',
      },
      toDate: {
        type: 'string',
        description: 'End date in YYYY-MM-DD format.',
      },
      categoryId: {
        type: 'string',
        description: 'Optional category identifier filter.',
      },
    },
    required: ['fromDate', 'toDate'],
  });
}

function getNetworkGraphToolDefinition() {
  return buildToolDefinition({
    name: 'get_network_graph',
    description:
      'Builds a network graph for a root entity such as a criminal, incident, or district.',
    properties: {
      rootType: {
        type: 'string',
        description:
          'Entity type, such as criminal, incident, district, or policeStation.',
      },
      rootId: {
        type: 'string',
        description: 'ROWID of the root entity.',
      },
      level: {
        type: 'string',
        description:
          'Optional graph scope: STATE, DISTRICT, STATION, or NODE.',
      },
    },
    required: ['rootType', 'rootId'],
  });
}

/* -------------------------------------------------------------------------- */
/* GET route tool definitions                                                  */
/* -------------------------------------------------------------------------- */

function getAdditionalGetToolDefinitions() {
  return [
    buildToolDefinition({
      name: 'get_current_user',
      description: 'Gets the authenticated current user.',
      properties: {},
      required: [],
    }),

    buildToolDefinition({
      name: 'get_all_crimes',
      description:
        'Gets crime incidents with optional filters and pagination.',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number.',
        },
        pageSize: {
          type: 'integer',
          description: 'Number of records per page.',
        },
        districtId: {
          type: 'string',
          description: 'Optional district ROWID.',
        },
        categoryId: {
          type: 'string',
          description: 'Optional crime category identifier.',
        },
        from: {
          type: 'string',
          description: 'Optional start date in YYYY-MM-DD format.',
        },
        to: {
          type: 'string',
          description: 'Optional end date in YYYY-MM-DD format.',
        },
        search: {
          type: 'string',
          description: 'Optional free-text search.',
        },
      },
      required: [],
    }),

    buildToolDefinition({
      name: 'get_one_crime',
      description: 'Gets one crime incident by ROWID.',
      properties: {
        id: {
          type: 'string',
          description: 'Crime incident ROWID.',
        },
      },
      required: ['id'],
    }),

    buildToolDefinition({
      name: 'get_victims_by_incident',
      description: 'Gets victims for an incident.',
      properties: {
        incidentId: {
          type: 'string',
          description: 'Incident ROWID.',
        },
      },
      required: ['incidentId'],
    }),

    buildToolDefinition({
      name: 'get_one_victim',
      description: 'Gets one victim by ROWID.',
      properties: {
        id: {
          type: 'string',
          description: 'Victim ROWID.',
        },
      },
      required: ['id'],
    }),

    buildToolDefinition({
      name: 'get_witnesses_by_incident',
      description: 'Gets witnesses for an incident.',
      properties: {
        incidentId: {
          type: 'string',
          description: 'Incident ROWID.',
        },
      },
      required: ['incidentId'],
    }),

    buildToolDefinition({
      name: 'get_one_witness',
      description: 'Gets one witness by ROWID.',
      properties: {
        id: {
          type: 'string',
          description: 'Witness ROWID.',
        },
      },
      required: ['id'],
    }),

    buildToolDefinition({
      name: 'get_officers_by_incident',
      description: 'Gets officers assigned to an incident.',
      properties: {
        incidentId: {
          type: 'string',
          description: 'Incident ROWID.',
        },
      },
      required: ['incidentId'],
    }),

    buildToolDefinition({
      name: 'get_incidents_by_officer',
      description: 'Gets incidents associated with an officer.',
      properties: {
        officerId: {
          type: 'string',
          description: 'Police officer ROWID.',
        },
        page: {
          type: 'integer',
          description: 'Page number.',
        },
        pageSize: {
          type: 'integer',
          description: 'Number of records per page.',
        },
      },
      required: ['officerId'],
    }),

    buildToolDefinition({
      name: 'get_one_crime_category',
      description: 'Gets one crime category by ROWID.',
      properties: {
        id: {
          type: 'string',
          description: 'Crime category ROWID.',
        },
      },
      required: ['id'],
    }),

    buildToolDefinition({
      name: 'get_all_criminals',
      description:
        'Gets all criminals with optional filters and pagination.',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number.',
        },
        pageSize: {
          type: 'integer',
          description: 'Number of records per page.',
        },
        search: {
          type: 'string',
          description: 'Optional free-text search.',
        },
      },
      required: [],
    }),

    buildToolDefinition({
      name: 'get_one_criminal',
      description: 'Gets one criminal by ROWID.',
      properties: {
        id: {
          type: 'string',
          description: 'Criminal ROWID.',
        },
      },
      required: ['id'],
    }),

    buildToolDefinition({
      name: 'get_criminal_risk_factors',
      description: 'Gets risk factors for a criminal.',
      properties: {
        criminalId: {
          type: 'string',
          description: 'Criminal ROWID.',
        },
      },
      required: ['criminalId'],
    }),

    buildToolDefinition({
      name: 'get_criminal_profile',
      description: 'Gets criminal profiling data.',
      properties: {
        criminalId: {
          type: 'string',
          description: 'Criminal ROWID.',
        },
      },
      required: ['criminalId'],
    }),

    buildToolDefinition({
      name: 'get_total_crime_count',
      description: 'Gets total crime count.',
      properties: {},
      required: [],
    }),

    buildToolDefinition({
      name: 'get_filtered_crime_count',
      description: 'Gets filtered crime count.',
      properties: {},
      required: [],
    }),

    buildToolDefinition({
      name: 'get_crime_count_with_previous_year',
      description:
        'Gets crime count with previous-year comparison.',
      properties: {},
      required: [],
    }),

    buildToolDefinition({
      name: 'get_crime_growth',
      description: 'Gets crime growth metrics.',
      properties: {},
      required: [],
    }),

    buildToolDefinition({
      name: 'get_category_volume_ranking',
      description: 'Gets crime category volume ranking.',
      properties: {},
      required: [],
    }),

    buildToolDefinition({
      name: 'get_crimes_by_evidence_paths',
      description: 'Gets crimes matching evidence paths.',
      properties: {
        paths: {
          type: 'string',
          description: 'Comma-separated evidence paths.',
        },
      },
      required: ['paths'],
    }),

    buildToolDefinition({
      name: 'get_all_evidence_matches',
      description: 'Gets all evidence matches.',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number.',
        },
        pageSize: {
          type: 'integer',
          description: 'Number of records per page.',
        },
      },
      required: [],
    }),

    buildToolDefinition({
      name: 'get_evidence_match_by_id',
      description: 'Gets one evidence match by ROWID.',
      properties: {
        id: {
          type: 'string',
          description: 'Evidence match ROWID.',
        },
      },
      required: ['id'],
    }),

    buildToolDefinition({
      name: 'get_evidence_matches_by_source',
      description:
        'Gets evidence matches for source evidence.',
      properties: {
        sourceId: {
          type: 'string',
          description: 'Source evidence ROWID.',
        },
      },
      required: ['sourceId'],
    }),

    buildToolDefinition({
      name: 'get_all_fir',
      description: 'Gets all FIR records.',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number.',
        },
        pageSize: {
          type: 'integer',
          description: 'Number of records per page.',
        },
        search: {
          type: 'string',
          description: 'Optional search.',
        },
      },
      required: [],
    }),

    buildToolDefinition({
      name: 'get_one_fir',
      description: 'Gets one FIR by ROWID.',
      properties: {
        id: {
          type: 'string',
          description: 'FIR ROWID.',
        },
      },
      required: ['id'],
    }),

    buildToolDefinition({
      name: 'get_all_districts',
      description: 'Gets all districts.',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number.',
        },
        pageSize: {
          type: 'integer',
          description: 'Number of records per page.',
        },
        search: {
          type: 'string',
          description: 'Optional search.',
        },
      },
      required: [],
    }),

    buildToolDefinition({
      name: 'get_one_district',
      description: 'Gets one district by ROWID.',
      properties: {
        id: {
          type: 'string',
          description: 'District ROWID.',
        },
      },
      required: ['id'],
    }),

    buildToolDefinition({
      name: 'get_all_district_geojson',
      description: 'Gets all district GeoJSON records.',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number.',
        },
        pageSize: {
          type: 'integer',
          description: 'Number of records per page.',
        },
      },
      required: [],
    }),

    buildToolDefinition({
      name: 'get_one_district_geojson',
      description:
        'Gets one district GeoJSON record by ROWID.',
      properties: {
        id: {
          type: 'string',
          description: 'District GeoJSON ROWID.',
        },
      },
      required: ['id'],
    }),

    buildToolDefinition({
      name: 'get_all_officers',
      description: 'Gets all police officers.',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number.',
        },
        pageSize: {
          type: 'integer',
          description: 'Number of records per page.',
        },
        search: {
          type: 'string',
          description: 'Optional search.',
        },
      },
      required: [],
    }),

    buildToolDefinition({
      name: 'get_one_officer',
      description: 'Gets one police officer by ROWID.',
      properties: {
        id: {
          type: 'string',
          description: 'Officer ROWID.',
        },
      },
      required: ['id'],
    }),

    buildToolDefinition({
      name: 'get_all_ranks',
      description: 'Gets all police ranks.',
      properties: {},
      required: [],
    }),

    buildToolDefinition({
      name: 'get_all_police_stations',
      description: 'Gets all police stations.',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number.',
        },
        pageSize: {
          type: 'integer',
          description: 'Number of records per page.',
        },
        search: {
          type: 'string',
          description: 'Optional search.',
        },
        districtId: {
          type: 'string',
          description: 'Optional district ROWID.',
        },
      },
      required: [],
    }),

    buildToolDefinition({
      name: 'get_one_police_station',
      description:
        'Gets one police station by ROWID.',
      properties: {
        id: {
          type: 'string',
          description: 'Police station ROWID.',
        },
      },
      required: ['id'],
    }),

    buildToolDefinition({
      name: 'get_all_station_types',
      description: 'Gets all police station types.',
      properties: {},
      required: [],
    }),

    buildToolDefinition({
      name: 'get_all_suspects',
      description: 'Gets all suspects.',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number.',
        },
        pageSize: {
          type: 'integer',
          description: 'Number of records per page.',
        },
        search: {
          type: 'string',
          description: 'Optional search.',
        },
      },
      required: [],
    }),

    buildToolDefinition({
      name: 'get_one_suspect',
      description: 'Gets one suspect by ROWID.',
      properties: {
        id: {
          type: 'string',
          description: 'Suspect ROWID.',
        },
      },
      required: ['id'],
    }),

    buildToolDefinition({
      name: 'get_suspect_photos',
      description: 'Gets photos for a suspect.',
      properties: {
        suspectId: {
          type: 'string',
          description: 'Suspect ROWID.',
        },
      },
      required: ['suspectId'],
    }),

    buildToolDefinition({
      name: 'get_forecasts',
      description: 'Gets forecast records.',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number.',
        },
        pageSize: {
          type: 'integer',
          description: 'Number of records per page.',
        },
      },
      required: [],
    }),

    buildToolDefinition({
      name: 'get_global_network_graph',
      description: 'Gets the global network graph.',
      properties: {
        level: {
          type: 'string',
          description: 'Optional graph scope.',
        },
      },
      required: [],
    }),

    buildToolDefinition({
      name: 'get_global_network_options',
      description: 'Gets global network graph options.',
      properties: {},
      required: [],
    }),

    buildToolDefinition({
      name: 'get_configuration',
      description: 'Gets a configuration by name.',
      properties: {
        name: {
          type: 'string',
          description: 'Configuration name.',
        },
      },
      required: ['name'],
    }),

    buildToolDefinition({
      name: 'get_all_configurations',
      description: 'Gets all configurations.',
      properties: {},
      required: [],
    }),

    buildToolDefinition({
      name: 'get_all_permissions',
      description: 'Gets all permissions.',
      properties: {},
      required: [],
    }),

    buildToolDefinition({
      name: 'get_all_roles',
      description:
        'Gets all roles with optional pagination/detail query.',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number.',
        },
        pageSize: {
          type: 'integer',
          description: 'Number of records per page.',
        },
        search: {
          type: 'string',
          description: 'Optional search.',
        },
        detail: {
          type: 'string',
          description: 'Optional detail query.',
        },
      },
      required: [],
    }),

    buildToolDefinition({
      name: 'get_one_role',
      description: 'Gets one role by ROWID.',
      properties: {
        id: {
          type: 'string',
          description: 'Role ROWID.',
        },
      },
      required: ['id'],
    }),

    buildToolDefinition({
      name: 'get_all_users',
      description: 'Gets all users.',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number.',
        },
        pageSize: {
          type: 'integer',
          description: 'Number of records per page.',
        },
        search: {
          type: 'string',
          description: 'Optional search.',
        },
      },
      required: [],
    }),

    buildToolDefinition({
      name: 'get_all_users_v2',
      description:
        'Gets users including invites and requests.',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number.',
        },
        pageSize: {
          type: 'integer',
          description: 'Number of records per page.',
        },
        search: {
          type: 'string',
          description: 'Optional search.',
        },
      },
      required: [],
    }),

    buildToolDefinition({
      name: 'get_all_user_invites',
      description: 'Gets all user invitations.',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number.',
        },
        pageSize: {
          type: 'integer',
          description: 'Number of records per page.',
        },
      },
      required: [],
    }),

    buildToolDefinition({
      name: 'get_record_counts',
      description: 'Gets record counts for all tables.',
      properties: {},
      required: [],
    }),

    buildToolDefinition({
      name: 'get_storage_object',
      description:
        'Downloads a stored file/object by folder and filename.',
      properties: {
        folder: {
          type: 'string',
          description: 'Storage folder.',
        },
        filename: {
          type: 'string',
          description: 'Stored filename.',
        },
      },
      required: ['folder', 'filename'],
    }),

    buildToolDefinition({
      name: 'redirect_to_app_login',
      description:
        'Redirects to the CrimeLens application login page.',
      properties: {},
      required: [],
    }),
  ];
}

/* -------------------------------------------------------------------------- */
/* All available tools                                                        */
/* -------------------------------------------------------------------------- */

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

    ...getAdditionalGetToolDefinitions(),
  ];
}

/* -------------------------------------------------------------------------- */
/* Crime lookup                                                               */
/* -------------------------------------------------------------------------- */

const CRIME_LLM_MAX_RECORDS = 30;
const CRIME_LLM_MAX_PAYLOAD_CHARS = 24000;
const CRIME_LLM_MAX_RECORD_CHARS = 1200;
const CRIME_LLM_MAX_ARRAY_ITEMS = 5;

const LARGE_CRIME_FIELDS = new Set([
  'evidence',
  'evidences',
  'evidencefiles',
  'evidence_files',
  'photos',
  'images',
  'attachments',
  'files',
  'documents',
  'geojson',
  'geometry',
  'coordinates',
  'rawdata',
  'raw_data',
  'metadata',
  'auditlog',
  'audit_log',
]);

function isLargeCrimeField(key) {
  const normalized = String(key || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

  return LARGE_CRIME_FIELDS.has(normalized);
}

function compactCrimeValue(value, depth = 0) {
  if (value === null || value === undefined) {
    return value;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (depth >= 2) {
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }

    if (typeof value === 'object') {
      return '[object]';
    }

    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, CRIME_LLM_MAX_ARRAY_ITEMS)
      .map((item) => compactCrimeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const output = {};

    for (const [key, childValue] of Object.entries(value)) {
      if (isLargeCrimeField(key)) {
        continue;
      }

      output[key] = compactCrimeValue(childValue, depth + 1);
    }

    return output;
  }

  return String(value);
}

function compactCrimeRecord(record) {
  if (!record || typeof record !== 'object') {
    return record;
  }

  const compacted = {};

  for (const [key, value] of Object.entries(record)) {
    if (isLargeCrimeField(key)) {
      continue;
    }

    const compactValue = compactCrimeValue(value);

    try {
      if (
        JSON.stringify(compactValue).length <=
        CRIME_LLM_MAX_RECORD_CHARS
      ) {
        compacted[key] = compactValue;
      }
    } catch {
      // Ignore values that cannot be serialized.
    }
  }

  return compacted;
}

function optimizeCrimeRecords(crimes) {
  if (!Array.isArray(crimes) || crimes.length === 0) {
    return {
      records: [],
      recordsReturned: 0,
      recordsOmitted: 0,
      truncated: false,
    };
  }

  const records = [];
  let payloadSize = 0;

  for (const crime of crimes.slice(0, CRIME_LLM_MAX_RECORDS)) {
    const compacted = compactCrimeRecord(crime);

    let serialized;

    try {
      serialized = JSON.stringify(compacted);
    } catch {
      continue;
    }

    if (
      records.length > 0 &&
      payloadSize + serialized.length >
        CRIME_LLM_MAX_PAYLOAD_CHARS
    ) {
      break;
    }

    records.push(compacted);
    payloadSize += serialized.length;
  }

  return {
    records,
    recordsReturned: records.length,
    recordsOmitted: Math.max(
      0,
      crimes.length - records.length
    ),
    truncated: records.length < crimes.length,
  };
}

async function executeCrimeLookupTool(params, req) {
  const validated = validateToolParams(params);

  const district =
    await districtService.getDistrictByName(
      validated.districtName,
      req
    );

  if (!district || !district.ROWID) {
    throw new AppError(
      `District not found: ${validated.districtName}`,
      404
    );
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

  const result =
    await crimeService.getAllCrimes(
      crimeQuery,
      req
    );

  const crimes =
    Array.isArray(result && result.data)
      ? result.data
      : [];

  const totalRecords =
    result?.pagination?.totalRecords ??
    crimes.length;

  const optimized =
    optimizeCrimeRecords(crimes);

  return {
    district:
      district.district_name ||
      validated.districtName,

    districtId: district.ROWID,

    dateRange: {
      from: `${validated.fromYear}-01-01`,
      to: `${validated.toYear}-12-31`,
    },

    totalRecords,

    crimes: optimized.records,

    context: {
      recordsReturned:
        optimized.recordsReturned,

      recordsOmitted: Math.max(
        0,
        totalRecords -
          optimized.recordsReturned
      ),

      truncated:
        optimized.truncated ||
        totalRecords >
          optimized.recordsReturned,

      note:
        optimized.truncated ||
        totalRecords >
          optimized.recordsReturned
          ? 'Crime records were compacted and truncated for LLM context. Use totalRecords for the complete count; do not assume the returned records represent the complete dataset.'
          : 'All fetched crime records fit within the LLM context budget.',
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Existing executors                                                         */
/* -------------------------------------------------------------------------- */

async function executeDistrictLookupTool(
  params,
  req
) {
  const districtName = String(
    params?.districtName || ''
  ).trim();

  if (!districtName) {
    throw new AppError(
      'The district name is required.',
      400
    );
  }

  const district =
    await districtService.getDistrictByName(
      districtName,
      req
    );

  if (!district || !district.ROWID) {
    throw new AppError(
      `District not found: ${districtName}`,
      404
    );
  }

  return {
    district:
      district.district_name ||
      districtName,

    districtId: district.ROWID,

    row: district,
  };
}

async function executeCrimeCategoriesTool(
  params,
  req
) {
  const result =
    await crimeCategoryService.getAllCrimeCategories(
      {},
      req
    );

  return {
    totalRecords:
      Array.isArray(result)
        ? result.length
        : 0,

    categories:
      Array.isArray(result)
        ? result
        : [],
  };
}

async function executeOfficersTool(
  params,
  req
) {
  const q = {
    ...(params || {}),
  };

  const result =
    await officerService.getAllOfficers(
      q,
      req
    );

  return {
    totalRecords:
      Array.isArray(result)
        ? result.length
        : 0,

    officers:
      Array.isArray(result)
        ? result
        : [],
  };
}

async function executeCriminalByIdTool(
  params,
  req
) {
  const criminalId = String(
    params?.criminalId || ''
  ).trim();

  if (!criminalId) {
    throw new AppError(
      'criminalId is required.',
      400
    );
  }

  const result =
    await criminalService.getOneCriminal(
      criminalId,
      req
    );

  return {
    criminal: result,
  };
}

async function executeCriminalProfileTool(
  params,
  req
) {
  const criminalId = String(
    params?.criminalId || ''
  ).trim();

  if (!criminalId) {
    throw new AppError(
      'criminalId is required.',
      400
    );
  }

  const result =
    await criminalProfilingService.generateProfile(
      criminalId,
      req
    );

  return {
    profile: result,
  };
}

async function executeDistrictStatsTool(
  params,
  req
) {
  const query = {
    ...(params || {}),
    fromDate:
      params?.fromDate ||
      params?.from ||
      params?.startDate,

    toDate:
      params?.toDate ||
      params?.to ||
      params?.endDate,
  };

  const result =
    await dashboardService.getDistrictCrimeStats({
      query,
      catalyst: req.catalyst,
    });

  return result;
}

async function executeNetworkGraphTool(
  params,
  req
) {
  const rootType = String(
    params?.rootType || ''
  ).trim();

  const rootId = String(
    params?.rootId || ''
  ).trim();

  if (!rootType || !rootId) {
    throw new AppError(
      'rootType and rootId are required.',
      400
    );
  }

  const root = {
    type: rootType,
    id: rootId,
  };

  const level =
    params?.level || 'NODE';

  const filters = {};

  const result =
    await networkAnalysisService.buildNetworkGraph(
      req,
      root,
      filters
    );

  return {
    level,
    root,
    graph: result,
  };
}

/* -------------------------------------------------------------------------- */
/* GET route executor                                                         */
/* -------------------------------------------------------------------------- */

/*
 * IMPORTANT:
 *
 * The route file only tells us controller method names. The exact service
 * signatures for every controller are not present here.
 *
 * Therefore this function is intentionally a dispatcher placeholder for the
 * newly-defined GET tools. Map each case to its controller/service once the
 * corresponding controller files are available.
 */

async function executeAdditionalGetTool(
  toolName,
  params,
  req
) {
  const q = {
    ...(params || {}),
  };

  switch (toolName) {
    case 'get_current_user':
      // Ensure the request has an authenticated user (set by middleware)
      if (!req || !req.user) {
        throw new AppError('Unauthorized', 401);
      }

      // Call the actual auth service to retrieve the current user
      return await authService.getMe({ user: req.user }, req);

    case 'get_all_crimes':
      return crimeService.getAllCrimes(q, req);

    case 'get_one_crime':
      return crimeService.getOneCrime(
        q.id,
        req
      );

    case 'get_victims_by_incident':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_one_victim':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_witnesses_by_incident':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_one_witness':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_officers_by_incident':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_incidents_by_officer':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_crime_categories':
      return executeCrimeCategoriesTool(
        q,
        req
      );

    case 'get_one_crime_category':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_criminals':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_one_criminal':
      return criminalService.getOneCriminal(
        q.id,
        req
      );

    case 'get_criminal_risk_factors':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_criminal_profile':
      return executeCriminalProfileTool(
        {
          criminalId:
            q.criminalId,
        },
        req
      );

    case 'get_district_crime_stats':
      return executeDistrictStatsTool(
        q,
        req
      );

    case 'get_total_crime_count':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_filtered_crime_count':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_crime_count_with_previous_year':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_crime_growth':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_category_volume_ranking':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_crimes_by_evidence_paths':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_evidence_matches':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_evidence_match_by_id':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_evidence_matches_by_source':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_fir':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_one_fir':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_districts':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_one_district':
      return executeDistrictLookupTool(
        {
          districtName:
            q.districtName,
        },
        req
      );

    case 'get_all_district_geojson':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_one_district_geojson':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_officers':
      return executeOfficersTool(
        q,
        req
      );

    case 'get_one_officer':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_ranks':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_police_stations':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_one_police_station':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_station_types':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_suspects':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_one_suspect':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_suspect_photos':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_forecasts':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_global_network_graph':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_global_network_options':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_configuration':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_configurations':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_permissions':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_roles':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_one_role':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_users':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_users_v2':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_all_user_invites':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_record_counts':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'get_storage_object':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    case 'redirect_to_app_login':
      throw new AppError(`Tool not implemented: ${toolName}`, 501);

    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Tool dispatcher                                                            */
/* -------------------------------------------------------------------------- */

async function executeToolCall(
  toolName,
  params,
  req
) {
  const additionalToolNames =
    new Set(
      getAdditionalGetToolDefinitions().map(
        (tool) => tool.function.name
      )
    );

  if (
    additionalToolNames.has(toolName)
  ) {
    return executeAdditionalGetTool(
      toolName,
      params,
      req
    );
  }

  switch (toolName) {
    case 'get_crimes_for_district_year_range':
      return executeCrimeLookupTool(
        params,
        req
      );

    case 'get_district_by_name':
      return executeDistrictLookupTool(
        params,
        req
      );

    case 'get_all_crime_categories':
      return executeCrimeCategoriesTool(
        params,
        req
      );

    case 'get_officers':
      return executeOfficersTool(
        params,
        req
      );

    case 'get_criminal_by_id':
      return executeCriminalByIdTool(
        params,
        req
      );

    case 'generate_criminal_profile':
      return executeCriminalProfileTool(
        params,
        req
      );

    case 'get_district_crime_stats':
      return executeDistrictStatsTool(
        params,
        req
      );

    case 'get_network_graph':
      return executeNetworkGraphTool(
        params,
        req
      );

    default:
      throw new AppError(
        `Unsupported tool: ${toolName}`,
        400
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Exports                                                                    */
/* -------------------------------------------------------------------------- */

module.exports = {
  getCrimeLookupToolDefinition,
  getDistrictLookupToolDefinition,
  getCrimeCategoriesToolDefinition,
  getOfficersToolDefinition,
  getCriminalByIdToolDefinition,
  getCriminalProfileToolDefinition,
  getDistrictStatsToolDefinition,
  getNetworkGraphToolDefinition,

  getAdditionalGetToolDefinitions,
  getAvailableToolDefinitions,

  optimizeCrimeRecords,
  compactCrimeRecord,

  executeCrimeLookupTool,
  executeDistrictLookupTool,
  executeCrimeCategoriesTool,
  executeOfficersTool,
  executeCriminalByIdTool,
  executeCriminalProfileTool,
  executeDistrictStatsTool,
  executeNetworkGraphTool,
  executeAdditionalGetTool,

  executeToolCall,
};