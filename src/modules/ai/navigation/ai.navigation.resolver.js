'use strict';

const {
  AI_NAVIGATION_TARGETS,
  AI_NAVIGATION_ROUTES,
  AI_NAVIGATION_INTENTS,
  isValidNavigationTarget,
} = require('./ai.navigation.constants');

function normalizeDateValue(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().split('T')[0];
}

function buildDateRange(from, to) {
  const start = normalizeDateValue(from);
  const end = normalizeDateValue(to);

  if (!start && !end) return null;

  return {
    start: start || end,
    end: end || start,
  };
}

function resolveIntentFromMessage(message) {
  const text = String(message || '').toLowerCase();

  if (/(profile|details|information|record|history|background)/i.test(text) && /(criminal|suspect|person of interest|offender)/i.test(text)) {
    return AI_NAVIGATION_INTENTS.CRIMINAL_PROFILE;
  }

  if (/(officer|officers|police officer|police officers|constable|inspector|cop)/i.test(text)) {
    return AI_NAVIGATION_INTENTS.OFFICER_RECORDS;
  }

  if (/(criminal|criminals|suspect|suspects|person of interest|known offender)/i.test(text)) {
    return AI_NAVIGATION_INTENTS.CRIMINAL_RECORDS;
  }

  if (/(heatmap|hotspot|map)/i.test(text)) {
    return AI_NAVIGATION_INTENTS.CRIME_HEATMAP;
  }

  if (/(forecast|prediction|next 30 days|next .* days)/i.test(text)) {
    return AI_NAVIGATION_INTENTS.CRIME_FORECAST;
  }

  if (/(network|relationship|linked|association|connected|syndicate)/i.test(text)) {
    return AI_NAVIGATION_INTENTS.NETWORK_ANALYSIS;
  }

  if (/(trend|analysis|analytics|summary|report|compare|comparison|rank|rankings|statistics|statistical)/i.test(text)) {
    return AI_NAVIGATION_INTENTS.CRIME_ANALYTICS;
  }

  if (/(show me crimes|show crimes|list crimes|find crimes|view crimes|show cases|find cases|list cases|show .*cases|view .*records|find .*records|list .*records|show .*crime records|show .*theft cases|search .*crime)/i.test(text)) {
    return AI_NAVIGATION_INTENTS.CRIME_RECORDS;
  }

  if (/(crime|incident|district|police station|station)/i.test(text)) {
    return AI_NAVIGATION_INTENTS.CRIME_RECORDS;
  }

  return null;
}

function resolveTargetFromIntent(intent) {
  switch (intent) {
    case AI_NAVIGATION_INTENTS.CRIME_RECORDS:
      return AI_NAVIGATION_TARGETS.CRIME_RECORDS;
    case AI_NAVIGATION_INTENTS.OFFICER_RECORDS:
      return AI_NAVIGATION_TARGETS.OFFICER_RECORDS;
    case AI_NAVIGATION_INTENTS.CRIMINAL_RECORDS:
      return AI_NAVIGATION_TARGETS.CRIMINAL_RECORDS;
    case AI_NAVIGATION_INTENTS.CRIMINAL_PROFILE:
      return AI_NAVIGATION_TARGETS.CRIMINAL_PROFILE;
    case AI_NAVIGATION_INTENTS.CRIME_HEATMAP:
      return AI_NAVIGATION_TARGETS.HEATMAP;
    case AI_NAVIGATION_INTENTS.CRIME_FORECAST:
      return AI_NAVIGATION_TARGETS.FORECAST;
    case AI_NAVIGATION_INTENTS.NETWORK_ANALYSIS:
      return AI_NAVIGATION_TARGETS.NETWORK;
    case AI_NAVIGATION_INTENTS.CRIME_ANALYTICS:
      return AI_NAVIGATION_TARGETS.ANALYTICS;
    case AI_NAVIGATION_INTENTS.RISK_ANALYSIS:
      return AI_NAVIGATION_TARGETS.RISK;
    case AI_NAVIGATION_INTENTS.ALERTS:
      return AI_NAVIGATION_TARGETS.ALERTS;
    default:
      return null;
  }
}

function resolveFiltersFromToolResult(toolResult) {
  const filters = {};
  const districtName = toolResult?.district || null;
  const districtId = toolResult?.districtId || null;

  if (districtName || districtId) {
    filters.district = {
      id: districtId || null,
      label: districtName || 'Selected district',
    };
  }

  const dateRange = buildDateRange(
    toolResult?.dateRange?.from,
    toolResult?.dateRange?.to,
  );

  if (dateRange) {
    filters.dateRange = dateRange;
  }

  return filters;
}

async function resolveNavigation({ message, toolResult, req, intentData }) {
  const intent = intentData?.navigationIntent || resolveIntentFromMessage(message);
  const target = resolveTargetFromIntent(intent);

  if (!target || !isValidNavigationTarget(target)) {
    return null;
  }

  const route = AI_NAVIGATION_ROUTES[target];
  const filters = resolveFiltersFromToolResult(toolResult || {});

  if (Object.keys(filters).length === 0) {
    return null;
  }

  return {
    target,
    route,
    filters,
    reason: `Resolved ${target} navigation for the requested CrimeLens query.`,
    confidence: 0.9,
    intent,
  };
}

module.exports = {
  normalizeDateValue,
  buildDateRange,
  resolveIntentFromMessage,
  resolveTargetFromIntent,
  resolveFiltersFromToolResult,
  resolveNavigation,
};
