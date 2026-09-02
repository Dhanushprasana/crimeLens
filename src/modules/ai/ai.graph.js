"use strict";

const logger = require("../../config/logger");
const { AppError } = require("../../common/exceptions");
const {
  parseStructuredResponse,
  normalizeIntent,
} = require("./schemas/ai.schemas");
const { callOpenRouter } = require("./providers/openrouter.provider");
const {
  getAvailableToolDefinitions,
  executeToolCall,
} = require("./tools/crime.tool");

function buildIntentAndToolMessages(message) {
  return [
    {
      role: "system",
      content: `You are the CrimeLens router.

If the user is casual, return:
{"intentType":"casual","reply":"short helpful response"}

Otherwise call exactly ONE available CrimeLens tool.

Choose the most specific tool based on its description.
Extract all relevant IDs, dates, names and filters.
Do not call multiple tools.
Do not return text or JSON for business requests.

The tool definitions are the source of truth.

Special rule for crime queries:
- If the user mentions crimes/incidents/offences and a place (district/area) prefer the tool get_crimes_for_district_year_range.
- If the user does not provide fromYear/toYear, supply a recent default range covering the last 12 months. Represent years as four-digit strings (e.g., if current year is 2026 use fromYear: "2025" and toYear: "2026").
- Always return exactly one function call with valid JSON arguments when the request is business.
`,
    },
    {
      role: "user",
      content: message,
    },
  ];
}

// buildFinalMessage removed: using node logic instead of LLM to format final response

async function runGraph({ message, req }) {
  //logger.info('AI graph started', { message });

  const toolDefinitions = getAvailableToolDefinitions();
  const validToolNames = new Set(
    toolDefinitions.map((tool) => tool.function.name),
  );

  const intentMessages = buildIntentAndToolMessages(message);
  //logger.info('Intent+tool prompt payload', { messages: intentMessages, toolDefinitions });

  const decision = await callOpenRouter({
    messages: intentMessages,
    tools: toolDefinitions,
    toolChoice: "auto",
  });
  //logger.info('Intent+tool raw response', { decision });

  const toolCall =
    decision?.message?.tool_calls?.[0] ||
    (decision && typeof decision?.tool_calls !== "undefined"
      ? decision.tool_calls[0]
      : null) ||
    null;

  //logger.info('Resolved tool call', { toolCall });

  // No tool call -> treat as casual conversation, parse the plain JSON reply.
  if (!toolCall) {
    const intentData = parseStructuredResponse(decision);
    //logger.info('Casual parsed response', { intentData });

    if (!intentData) {
      throw new AppError(
        "The AI classifier returned an invalid structure.",
        400,
      );
    }

    const intentType = normalizeIntent(
      intentData.intentType || intentData.type,
    );

    if (intentType !== "casual") {
      // Model claimed "business" but didn't call a tool - treat as invalid.
      throw new AppError(
        "The AI did not choose a valid CrimeLens tool for this request.",
        400,
      );
    }

    // Return a clean `data` object; controller will wrap with success flag
    return {
      type: "casual",
      message: intentData.reply || "How can I help with CrimeLens?",
    };
  }

  // Tool call present -> business intent.
  const toolName = toolCall?.function?.name || toolCall?.name || null;
  if (!validToolNames.has(toolName)) {
    throw new AppError(
      "The AI did not choose a valid CrimeLens tool for this request.",
      400,
    );
  }

  let args = {};
  try {
    const candidateArgs =
      toolCall.function?.arguments || toolCall.arguments || "{}";
    args = JSON.parse(candidateArgs);
  } catch (err) {
    logger.error("Tool arg parse failed", { toolCall, error: err.message });
    throw new AppError(
      "The AI selected a tool with malformed parameters.",
      400,
    );
  }

  const intentData = { intentType: "business", toolName, args };

  //logger.info('Executing CrimeLens tool with args', { args });
  const toolResult = await executeToolCall(toolName, args, req);
  //logger.info('CrimeLens tool result', { toolResult });

  let finalResponse = { type: "business" };

  function buildNavigation(toolName, args, toolResult) {
    const nav = { route: null, filters: {} };

    switch (toolName) {
      case 'get_crimes_for_district_year_range':
        nav.route = '/entities/crimes';
        // support queries for all districts (no districtName) as well as specific district
        const districtVal = (args.districtName || toolResult?.district || null);
        nav.filters = {
          district: districtVal && String(districtVal).toLowerCase() !== 'all' ? districtVal : null,
          startDate:
            toolResult?.dateRange?.from || (args.fromYear ? `${args.fromYear}-01-01` : args.from || null),
          endDate:
            toolResult?.dateRange?.to || (args.toYear ? `${args.toYear}-12-31` : args.to || null),
          crimeType: args.categoryId || args.category || null,
        };
        break;

      case 'get_all_crimes':
        nav.route = '/entities/crimes';
        nav.filters = {
          district: args.districtId || null,
          startDate: args.from || (args.fromYear ? `${args.fromYear}-01-01` : null),
          endDate: args.to || (args.toYear ? `${args.toYear}-12-31` : null),
          crimeType: args.categoryId || args.category || null,
          search: args.search || null,
        };
        break;

      case 'get_district_by_name':
        nav.route = '/administration/districts';
        nav.filters = {
          district: args.districtName || toolResult?.district || null,
        };
        break;

      case 'get_criminal_by_id':
      case 'get_one_criminal':
        nav.route = '/entities/criminals/:criminalId';
        nav.filters = { criminalId: args.criminalId || args.id || null };
        break;

      case 'get_network_graph':
        nav.route = '/network';
        nav.filters = { rootType: args.rootType || null, rootId: args.rootId || null };
        break;

      case 'get_current_user':
        nav.route = '/administration/profile';
        nav.filters = {};
        break;

      case 'get_district_crime_stats':
        nav.route = '/dashboard';
        nav.filters = {
          startDate: args.fromDate || args.from || null,
          endDate: args.toDate || args.to || null,
          categoryId: args.categoryId || null,
        };
        break;

      case 'get_all_districts':
        nav.route = '/administration/districts';
        nav.filters = {};
        break;

      default:
        nav.route = null;
        nav.filters = {};
    }

    return nav;
  }

  // Format the final response using a switch/if-else block to avoid the slow LLM call
  if (toolName === "get_crimes_for_district_year_range") {
    finalResponse.summary = `Found ${toolResult.totalRecords} crime incidents in ${toolResult.district} between ${toolResult.dateRange.from} and ${toolResult.dateRange.to}.`;
    finalResponse.district = toolResult.district;
    finalResponse.dateRange = toolResult.dateRange;
    finalResponse.crimeCount = toolResult.totalRecords;
    finalResponse.crimes = toolResult.crimes;
  } else if (toolName === "get_district_by_name") {
    finalResponse.summary = `Found details for district ${toolResult.district}.`;
    finalResponse.district = toolResult.district;
    finalResponse.details = toolResult.row;
  } else if (toolName === "get_all_crime_categories") {
    finalResponse.summary = `Found ${toolResult.totalRecords} crime categories.`;
    finalResponse.categories = toolResult.categories;
  } else if (toolName === "get_officers") {
    finalResponse.summary = `Found ${toolResult.totalRecords} police officers.`;
    finalResponse.officers = toolResult.officers;
  } else if (toolName === "get_criminal_by_id") {
    finalResponse.summary = `Found details for criminal ID ${args.criminalId}.`;
    finalResponse.criminal = toolResult.criminal;
  } else if (toolName === "generate_criminal_profile") {
    finalResponse.summary = `Generated profile for criminal ID ${args.criminalId}.`;
    finalResponse.profile = toolResult.profile;
  } else if (toolName === "get_district_crime_stats") {
    finalResponse.summary = `Generated crime stats for the specified date range.`;
    finalResponse.stats = toolResult;
  } else if (toolName === "get_network_graph") {
    finalResponse.summary = `Generated network graph for ${args.rootType} with ID ${args.rootId}.`;
    finalResponse.level = toolResult.level;
    finalResponse.root = toolResult.root;
    finalResponse.graph = toolResult.graph;
  } else {
    finalResponse.summary = "Data fetched successfully.";
    finalResponse.data = toolResult;
  }

  // Build public-facing result: keep tool-specific useful data under `result`.
  const resultPayload = { ...finalResponse };
  const summary = resultPayload.summary || "";
  // remove summary and any internal type marker from result
  delete resultPayload.summary;
  delete resultPayload.type;

  // attach navigation hints for the front-end where applicable
  const navigation = buildNavigation(toolName, args, toolResult);
  if (navigation.route) {
    // prefer placing navigation inside the result object
    if (resultPayload.data !== undefined) {
      resultPayload.data = { ...(resultPayload.data || {}), navigation };
    } else {
      resultPayload.navigation = navigation;
    }
  }

  return {
    type: "business",
    summary: summary || "",
    result:
      resultPayload.data !== undefined
        ? resultPayload.data
        : // if finalResponse used custom fields, return them
          resultPayload,
  };
}

module.exports = {
  runGraph,
};
