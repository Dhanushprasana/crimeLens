'use strict';

const logger = require('../../config/logger');
const { AppError } = require('../../common/exceptions');
const { parseStructuredResponse, normalizeIntent } = require('./schemas/ai.schemas');
const { callOpenRouter } = require('./providers/openrouter.provider');
const {
  getAvailableToolDefinitions,
  executeToolCall,
} = require('./tools/crime.tool');

function buildClassificationMessages(message) {
  return [
    {
      role: 'system',
      content: `You are CrimeLens Intent Classifier. Decide if the user message is a casual conversation or a CrimeLens business request. Your response must be valid JSON and nothing else.

Rules:
- If the message is casual conversation, return exactly: {"intentType":"casual","reply":"short helpful response"}
- If the message is a CrimeLens business request, return exactly: {"intentType":"business","reason":"clear explanation of why this is a business request","districtName":"district name if mentioned, otherwise null","fromYear":"YYYY if mentioned, otherwise null","toYear":"YYYY if mentioned, otherwise null"}
- Never return an incomplete object.
- Never include markdown fences, commentary, or trailing text.
- If the user asks for crime data but omits a date range, still return a business object with null for missing years.`
    },
    {
      role: 'user',
      content: message,
    },
  ];
}

function buildToolSelectionMessages(message) {
  return [
    {
      role: 'system',
      content: `You are CrimeLens Tool Router. The user asked for a CrimeLens business action. Select the single best available tool and return a tool call in the OpenAI function-calling format. Choose from the following tools: get_crimes_for_district_year_range, get_district_by_name, get_all_crime_categories, get_officers, get_criminal_by_id, generate_criminal_profile, get_district_crime_stats, get_network_graph. Only call a tool if it matches the user's question. Return valid JSON as a tool call payload.`
    },
    {
      role: 'user',
      content: message,
    },
  ];
}

function buildFinalMessage(toolResult, message) {
  return [
    {
      role: 'system',
      content: `You are the CrimeLens response generator. Use the tool data to create a concise, structured final JSON answer for the user. Return only valid JSON with this schema: {"type":"business","summary":"...","district":"...","dateRange":{"from":"YYYY-MM-DD","to":"YYYY-MM-DD"},"crimeCount":123,"crimes":[{"ROWID":"...","title":"...","status":"...","crime_number":"...","crime_occured_date_time":"..."}]}`
    },
    {
      role: 'user',
      content: `Original user request: ${message}\n\nTool result: ${JSON.stringify(toolResult)}`,
    },
  ];
}

async function runGraph({ message, req }) {
  //logger.info('AI graph started', { message });

  const classifierMessages = buildClassificationMessages(message);
  //logger.info('Classifier prompt payload', { messages: classifierMessages });

  const classification = await callOpenRouter({
    messages: classifierMessages,
  });
  //logger.info('Classifier raw response', { classification });

  const intentData = parseStructuredResponse(classification);
  //logger.info('Classifier parsed intent', { intentData });

  if (!intentData) {
    throw new AppError('The AI classifier returned an invalid structure.', 400);
  }

  const intentType = normalizeIntent(intentData.intentType || intentData.type);
  //logger.info('Normalized intent type', { intentType, rawIntent: intentData.intentType || intentData.type });

  if (intentType === 'casual') {
    //logger.info('AI graph returning casual response', { intentData });
    return {
      type: 'casual',
      classification: intentData,
      response: {
        message: intentData.reply || 'How can I help with CrimeLens?',
      },
    };
  }

  const toolDefinitions = getAvailableToolDefinitions();
  const validToolNames = new Set(toolDefinitions.map((tool) => tool.function.name));
  //logger.info('Tool router payload', {
//     messages: buildToolSelectionMessages(message),
//     toolDefinitions,
//   });

  const toolDecision = await callOpenRouter({
    messages: buildToolSelectionMessages(message),
    tools: toolDefinitions,
    toolChoice: 'auto',
  });
  //logger.info('Tool router raw response', { toolDecision });

  const toolCall = toolDecision?.message?.tool_calls?.[0]
    || (toolDecision && typeof toolDecision?.tool_calls !== 'undefined' ? toolDecision.tool_calls[0] : null)
    || (toolDecision?.message?.content ? JSON.parse(toolDecision.message.content) : null);

  //logger.info('Resolved tool call', { toolCall });

  const toolName = toolCall?.function?.name || toolCall?.name || (toolCall && toolCall.function ? toolCall.function.name : null);
  if (!toolCall || !validToolNames.has(toolName)) {
    throw new AppError('The AI did not choose a valid CrimeLens tool for this request.', 400);
  }

  let args = {};
  try {
    const candidateArgs = toolCall.function?.arguments || toolCall.arguments || '{}';
    args = JSON.parse(candidateArgs);
  } catch (err) {
    logger.error('Tool arg parse failed', { toolCall, error: err.message });
    throw new AppError('The AI selected a tool with malformed parameters.', 400);
  }

  //logger.info('Executing CrimeLens tool with args', { args });
  const toolResult = await executeToolCall(toolName, args, req);
  //logger.info('CrimeLens tool result', { toolResult });

  const finalPrompt = buildFinalMessage(toolResult, message);
  //logger.info('Final generation prompt', { messages: finalPrompt });

  const finalChoice = await callOpenRouter({
    messages: finalPrompt,
  });
  //logger.info('Final model raw response', { finalChoice });

  const finalResponse = parseStructuredResponse(finalChoice);
  //logger.info('Final parsed response', { finalResponse });

  if (!finalResponse) {
    throw new AppError('The final AI response could not be parsed as JSON.', 500);
  }

  return {
    type: 'business',
    classification: intentData,
    toolResult,
    response: finalResponse,
  };
}

module.exports = {
  runGraph,
};
