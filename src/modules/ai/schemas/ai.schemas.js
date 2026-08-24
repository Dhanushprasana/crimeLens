'use strict';

const { AppError } = require('../../../common/exceptions');

function parseStructuredResponse(payload) {
  if (!payload) {
    return null;
  }

  if (payload.message && payload.message.content) {
    return parseStructuredResponse(payload.message.content);
  }

  if (payload.message && payload.message.tool_calls) {
    return payload.message;
  }

  const raw = payload?.message?.content || payload?.content || payload;
  if (raw == null) {
    return null;
  }

  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const trimmed = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      if (parsed.intentType === 'business') {
        return {
          ...parsed,
          reason: parsed.reason || 'Business request identified.',
          districtName: parsed.districtName ?? null,
          fromYear: parsed.fromYear ?? null,
          toYear: parsed.toYear ?? null,
        };
      }
      if (parsed.intentType === 'casual') {
        return {
          ...parsed,
          reply: parsed.reply || 'How can I help with CrimeLens?',
        };
      }
    }
    return parsed;
  } catch (err) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      const parsed = JSON.parse(match[0]);
      if (parsed && typeof parsed === 'object' && parsed.intentType === 'business') {
        return {
          ...parsed,
          reason: parsed.reason || 'Business request identified.',
          districtName: parsed.districtName ?? null,
          fromYear: parsed.fromYear ?? null,
          toYear: parsed.toYear ?? null,
        };
      }
      return parsed;
    } catch (nestedErr) {
      return null;
    }
  }
}

function normalizeIntent(rawIntent) {
  const intent = String(rawIntent || '').trim().toLowerCase();
  if (['casual', 'chat', 'conversation', 'general'].includes(intent)) {
    return 'casual';
  }
  if (['business', 'crime', 'crime_request', 'crime-lens', 'tool_request'].includes(intent)) {
    return 'business';
  }
  return 'business';
}

function validateToolParams(params) {
  if (!params || typeof params !== 'object') {
    throw new AppError('The AI tool parameters were not provided in a valid format.', 400);
  }

  const districtName = String(params.districtName || '').trim();
  const fromYear = String(params.fromYear || '').trim();
  const toYear = String(params.toYear || '').trim();

  if (!districtName) {
    throw new AppError('The AI tool requires a district name.', 400);
  }

  if (!/^\d{4}$/.test(fromYear) || !/^\d{4}$/.test(toYear)) {
    throw new AppError('The AI tool requires valid 4-digit year values.', 400);
  }

  if (Number(fromYear) > Number(toYear)) {
    throw new AppError('The start year cannot be greater than the end year.', 400);
  }

  return {
    districtName,
    fromYear,
    toYear,
  };
}

module.exports = {
  parseStructuredResponse,
  normalizeIntent,
  validateToolParams,
};
