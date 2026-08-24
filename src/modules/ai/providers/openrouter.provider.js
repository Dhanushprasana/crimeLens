'use strict';

const logger = require('../../../config/logger');
const env = require('../../../config/env');

const OPENROUTER_API_URL = env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

function safeLogValue(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return String(value);
  }
}

async function callOpenRouter({ messages, tools = [], toolChoice = 'auto', temperature = 0 }) {
//   logger.info('OpenRouter call start', {
//     model: DEFAULT_MODEL,
//     toolCount: tools.length,
//     toolChoice,
//     temperature,
//     messages,
//   });

  if (!env.OPENROUTER_API_KEY) {
    const lastUserMessage = (messages || []).filter((m) => m.role === 'user').slice(-1)[0]?.content || '';
    const normalized = String(lastUserMessage).toLowerCase();
    // logger.info('OpenRouter fallback trigger', { reason: 'OPENROUTER_API_KEY missing', normalized });

    if (tools.length > 0) {
      const districtNameMatch = normalized.match(/for\s+([a-z ]+)/i);
      const districtName = districtNameMatch ? districtNameMatch[1].trim().replace(/\s+/g, ' ') : 'Bangalore Urban';
      const fromYear = /2025/.test(normalized) ? '2025' : '2024';
      const toYear = /2026/.test(normalized) ? '2026' : (Number(fromYear) + 1).toString();

      const fallbackToolCall = {
        message: {
          role: 'assistant',
          tool_calls: [{
            id: 'call_local_tool',
            type: 'function',
            function: {
              name: 'get_crimes_for_district_year_range',
              arguments: JSON.stringify({ districtName, fromYear, toYear }),
            },
          }],
        },
      };

      // logger.info('OpenRouter fallback tool payload', { fallbackToolCall });
      return fallbackToolCall;
    }

    const intentPayload = /show me crimes|crime|incident|district/.test(normalized)
      ? {
          intentType: 'business',
          reason: 'The user is requesting CrimeLens crime data for a district and year range.',
        }
      : {
          intentType: 'casual',
          reply: 'I can help with CrimeLens insights and district crime questions.',
        };

    const fallbackResponse = {
      message: {
        role: 'assistant',
        content: JSON.stringify(intentPayload),
      },
    };

    // logger.info('OpenRouter fallback intent payload', { fallbackResponse });
    return fallbackResponse;
  }

  const payload = {
    model: DEFAULT_MODEL,
    temperature,
    messages,
  };

  if (tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = toolChoice;
  }

  // logger.info('OpenRouter HTTP payload', { payload });

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:3001',
      'X-Title': 'CrimeLens AI Chatbot',
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();
  // logger.info('OpenRouter raw HTTP response', {
  //   status: response.status,
  //   statusText: response.statusText,
  //   bodyPreview: rawBody.slice(0, 1500),
  // });

  let body;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch (err) {
    logger.error('OpenRouter invalid JSON body', { rawBody: safeLogValue(rawBody) });
    throw new Error(`OpenRouter returned invalid JSON: ${rawBody.slice(0, 300)}`);
  }

  if (!response.ok) {
    const errorText = body?.error?.message || rawBody || 'OpenRouter request failed';
    logger.error('OpenRouter API error', { errorText, body });
    throw new Error(`OpenRouter API error: ${errorText}`);
  }

  const choice = body.choices && body.choices[0];
  if (!choice) {
    logger.error('OpenRouter missing choice', { body });
    throw new Error('OpenRouter response did not contain a valid completion choice.');
  }

  // logger.info('OpenRouter parsed choice', { choice });
  return choice;
}

module.exports = {
  callOpenRouter,
};
