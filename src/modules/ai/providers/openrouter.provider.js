'use strict';

const logger = require('../../../config/logger');

const env = require('../../../config/env');

const OPENROUTER_API_URL =
  env.OPENROUTER_API_URL ||
  'https://openrouter.ai/api/v1/chat/completions';

const DEFAULT_MODEL =
  env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

/**
 * CrimeLens business intent keywords.
 *
 * All of the CrimeLens data/GET tools fall under business intent.
 * Keep this centralized so adding a new business domain does not require
 * changing the intent classification logic elsewhere.
 */
const BUSINESS_INTENT_PATTERN =
  /\b(crime|crimes|incident|incidents|district|districts|criminal|criminals|suspect|suspects|victim|victims|witness|witnesses|officer|officers|police|station|stations|rank|ranks|fir|evidence|forecast|forecasts|network|configuration|configurations|config|permission|permissions|role|roles|user|users|invite|invites|record|records|count|counts|growth|category|categories|risk|profile|profiles|profiling|geojson|geo|statistics|statistic|stats|volume|ranking|analytics|analysis|dashboard|data|reports|report)\b/i;

function safeLogValue(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return String(value);
  }
}

async function callOpenRouter({
  messages,
  tools = [],
  toolChoice = 'auto',
  temperature = 0,
}) {
  /**
   * Local fallback used when an OpenRouter API key is not configured.
   *
   * This is primarily useful for local development/testing.
   */
  if (!env.OPENROUTER_API_KEY) {
    const lastUserMessage =
      (messages || [])
        .filter((m) => m.role === 'user')
        .slice(-1)[0]?.content || '';

    const normalized =
      String(lastUserMessage).toLowerCase();

    /**
     * If tools are available, return a business tool call.
     *
     * The local fallback currently defaults to the crime lookup tool.
     * When OpenRouter is configured, the actual model selects the
     * appropriate tool from the full tool definition list.
     */
    if (tools.length > 0) {
      const isBusinessRequest =
        BUSINESS_INTENT_PATTERN.test(normalized);

      if (isBusinessRequest) {
        const districtNameMatch =
          normalized.match(
            /for\s+([a-z][a-z\s-]*?)(?:\s+(?:from|between|in|during|for)\b|$)/i
          );

        const districtName = districtNameMatch
          ? districtNameMatch[1]
              .trim()
              .replace(/\s+/g, ' ')
              .replace(/[.,!?]+$/, '')
          : 'Bangalore Urban';

        const fromYearMatch =
          normalized.match(
            /\b(20\d{2})\b/
          );

        const years =
          normalized.match(
            /\b(20\d{2})\b.*?\b(20\d{2})\b/
          );

        const fromYear =
          years?.[1] ||
          fromYearMatch?.[1] ||
          '2024';

        const toYear =
          years?.[2] ||
          (
            Number(fromYear) + 1
          ).toString();

        /**
         * Prefer the crime lookup tool if it exists.
         * Otherwise use the first available tool.
         */
        const crimeTool =
          tools.find(
            (tool) =>
              tool?.function?.name ===
              'get_crimes_for_district_year_range'
          );

        const selectedTool =
          crimeTool || tools[0];

        return {
          message: {
            role: 'assistant',

            tool_calls: [
              {
                id: 'call_local_tool',
                type: 'function',

                function: {
                  name:
                    selectedTool?.function?.name ||
                    'get_crimes_for_district_year_range',

                  arguments:
                    JSON.stringify({
                      districtName,
                      fromYear,
                      toYear,
                    }),
                },
              },
            ],
          },
        };
      }

      /**
       * The request is not a CrimeLens business request.
       * Do not force a business tool call.
       */
      return {
        message: {
          role: 'assistant',
          content:
            'I can help with CrimeLens insights and district crime questions.',
        },
      };
    }

    /**
     * No tools supplied → perform local intent classification.
     */
    const intentPayload =
      BUSINESS_INTENT_PATTERN.test(normalized)
        ? {
            intentType: 'business',
            reason:
              'The user is requesting CrimeLens business data, analytics, records, relationships, or operational information that can be retrieved using CrimeLens tools.',
          }
        : {
            intentType: 'casual',
            reply:
              'I can help with CrimeLens insights and district crime questions.',
          };

    const fallbackResponse = {
      message: {
        role: 'assistant',
        content:
          JSON.stringify(intentPayload),
      },
    };

    // logger.info(
    //   'OpenRouter fallback intent payload',
    //   { fallbackResponse }
    // );

    return fallbackResponse;
  }

  /**
   * Actual OpenRouter request.
   */
  const payload = {
    model: DEFAULT_MODEL,
    temperature,
    messages,
  };

  if (tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = toolChoice;
  }

  const response = await fetch(
    OPENROUTER_API_URL,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',

        Authorization:
          `Bearer ${env.OPENROUTER_API_KEY}`,

        'HTTP-Referer':
          process.env.APP_URL ||
          'http://localhost:3001',

        'X-Title':
          'CrimeLens AI Chatbot',
      },

      body: JSON.stringify(payload),
    }
  );

  const rawBody =
    await response.text();

  let body;

  try {
    body =
      rawBody
        ? JSON.parse(rawBody)
        : {};
  } catch (err) {
    logger.error(
      'OpenRouter invalid JSON body',
      {
        rawBody:
          safeLogValue(rawBody),
      }
    );

    throw new Error(
      `OpenRouter returned invalid JSON: ${rawBody.slice(
        0,
        300
      )}`
    );
  }

  if (!response.ok) {
    const errorText =
      body?.error?.message ||
      rawBody ||
      'OpenRouter request failed';

    logger.error(
      'OpenRouter API error',
      {
        errorText,
        body,
      }
    );

    throw new Error(
      `OpenRouter API error: ${errorText}`
    );
  }

  const choice =
    body.choices &&
    body.choices[0];

  if (!choice) {
    logger.error(
      'OpenRouter missing choice',
      {
        body,
      }
    );

    throw new Error(
      'OpenRouter response did not contain a valid completion choice.'
    );
  }

  return choice;
}

module.exports = {
  callOpenRouter,
};