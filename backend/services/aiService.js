const axios = require('axios');
const { appConfig } = require('../config/env');
const { generateRecommendationPlan } = require('./recommendationEngineService');
const { logServerWarning } = require('../utils/logger');

const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const OPENAI_CHAT_COMPLETIONS_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const MAX_ITINERARY_DAYS = 14;
const MAX_ACTIVITIES_PER_DAY = 6;
const MAX_MONUMENTS = 24;
const DEFAULT_MAX_OUTPUT_TOKENS = 9000;
const RETRY_MAX_OUTPUT_TOKENS = 12000;
const MAX_TEXT_LENGTH = 260;
const DEFAULT_LANGUAGE = 'en';
const DEFAULT_TRAVEL_MODE = 'DRIVE';

const ITINERARY_DEVELOPER_PROMPT = `You are the itinerary generation engine for Personalized Tourist Guide AI.

Create practical, realistic and map-friendly travel itineraries that can be followed by a traveller using Google Maps.

You must respect the selected country, selected city or cities, interests, trip duration, user free-text request and travel context. Prioritise real places, coherent geographical order, reasonable pacing, clear stop names and useful explanations.

Critical route rules:
- Treat selectedCities as an ordered route, not as an unordered wishlist.
- If selectedCities has one city, build the whole itinerary around that city and nearby places only.
- If selectedCities has two or more cities, the first selected city is the origin and the last selected city is the final destination.
- For multi-city trips, the itinerary must progress naturally from origin to destination by car.
- Do not alternate between origin and destination after the traveller has already moved forward.
- Do not return to an earlier selected city unless the user explicitly asks for a round trip.
- Include sensible intermediate stops along the driving corridor when the trip duration is longer than the direct journey.
- The final day must end in or near the final destination.
- The monuments array must follow the exact chronological route order from day 1 to the final day.
- The route must be possible to drive in the order returned.

Do not invent exact opening hours, ticket prices, temporary events, closures or transport availability. If such details are uncertain, keep them generic.

Quality rules:
- Prefer specific real places over vague suggestions.
- Every stop must have a clear name.
- Every stop should include a city and country.
- Use complete addresses when reasonably known, but never invent street numbers.
- Food stops must be realistic and locally relevant.
- The order within each day must be logical: morning, lunch, afternoon and optional evening.
- Avoid sending the user back and forth across the same city unnecessarily.
- For 1 day, use 4 to 6 stops.
- For 2 to 3 days, use 4 to 6 stops per day.
- For longer trips, keep each day focused and realistic instead of adding filler.
- Include a balanced mix of landmarks, viewpoints, food stops, local culture and hidden gems when appropriate.
- If the request is vague, create a balanced first-time visitor itinerary.
- If the request is specific, follow it closely.
- Do not include unsafe, illegal or inaccessible recommendations.
- Do not include duplicated stops.
- Do not include fake coordinates.
- Do not include markdown, comments or text outside the required structured output.

The output will be enriched later with Google Places and Google Routes, so placeQuery and mapsSearchHint must be useful search strings. Every placeQuery should include the stop name, city and country when known.`;

const textField = { type: 'string' };
const nullableTextField = { type: ['string', 'null'] };
const nullableIntegerField = { type: ['integer', 'null'] };

const activitySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'period',
    'name',
    'placeQuery',
    'address',
    'city',
    'country',
    'category',
    'durationMinutes',
    'reason',
    'mapsSearchHint',
  ],
  properties: {
    period: {
      type: 'string',
      enum: ['morning', 'lunch', 'afternoon', 'evening', 'flexible'],
    },
    name: textField,
    placeQuery: textField,
    address: nullableTextField,
    city: textField,
    country: textField,
    category: {
      type: 'string',
      enum: ['landmark', 'museum', 'viewpoint', 'food', 'culture', 'nature', 'shopping', 'experience', 'transport', 'other'],
    },
    durationMinutes: nullableIntegerField,
    reason: textField,
    mapsSearchHint: textField,
  },
};

const monumentSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name',
    'placeQuery',
    'address',
    'city',
    'country',
    'category',
    'tags',
    'durationMinutes',
    'reason',
    'mapsSearchHint',
  ],
  properties: {
    name: textField,
    placeQuery: textField,
    address: nullableTextField,
    city: textField,
    country: textField,
    category: textField,
    tags: {
      type: 'array',
      items: textField,
    },
    durationMinutes: nullableIntegerField,
    reason: textField,
    mapsSearchHint: textField,
  },
};

const openAIItinerarySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['itinerary', 'monuments', 'recommendation'],
  properties: {
    itinerary: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['day', 'title', 'city', 'summary', 'activities'],
        properties: {
          day: { type: 'integer' },
          title: textField,
          city: textField,
          summary: textField,
          activities: {
            type: 'array',
            items: activitySchema,
          },
        },
      },
    },
    monuments: {
      type: 'array',
      items: monumentSchema,
    },
    recommendation: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'summary', 'bestFor', 'pace', 'estimatedStops'],
      properties: {
        title: textField,
        summary: textField,
        bestFor: {
          type: 'array',
          items: textField,
        },
        pace: {
          type: 'string',
          enum: ['relaxed', 'moderate', 'active'],
        },
        estimatedStops: { type: 'integer' },
      },
    },
  },
};

function getProvider() {
  return appConfig.ai.provider;
}

function getAiTimeout() {
  // OpenAI structured itinerary generation can legitimately take longer than
  // small health/API calls, especially with route-order constraints. Keep the
  // env value configurable, but never let it be so low that normal requests
  // fall back silently during local demos.
  return Math.max(appConfig.ai.timeoutMs, 60000);
}

function normalizeText(value, maxLength = MAX_TEXT_LENGTH) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
    : '';
}

function normalizeOptionalText(value, maxLength = MAX_TEXT_LENGTH) {
  return typeof value === 'string' && value.trim()
    ? normalizeText(value, maxLength)
    : '';
}

function normalizeList(values, maxItems = 12, maxLength = 100) {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set();
  return values
    .map((value) => normalizeText(value, maxLength))
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}

function getTripDuration(selectedDays) {
  const rawDays = Array.isArray(selectedDays) && selectedDays.length > 0
    ? selectedDays[0]
    : selectedDays;
  const days = Number.parseInt(rawDays, 10);

  if (!Number.isInteger(days) || days < 1) {
    return 3;
  }

  return Math.min(days, MAX_ITINERARY_DAYS);
}

function getStopsTarget(days, options = {}) {
  if (options.compactOutput) {
    return {
      min: Math.min(Math.max(days, 4), 10),
      max: Math.min(Math.max(days + 2, 6), 14),
    };
  }

  if (days <= 1) {
    return { min: 4, max: 6 };
  }

  if (days <= 3) {
    return {
      min: Math.min(days * 4, MAX_MONUMENTS),
      max: Math.min(days * MAX_ACTIVITIES_PER_DAY, MAX_MONUMENTS),
    };
  }

  return {
    min: Math.min(Math.max(days, 6), 14),
    max: Math.min(Math.max(days * 2, 10), 18),
  };
}

function getTravelMode(options = {}) {
  const preferenceMode = options.userPreferences?.transportMode;
  if (preferenceMode === 'walking') {
    return 'WALK';
  }
  if (preferenceMode === 'transit') {
    return 'TRANSIT';
  }

  return DEFAULT_TRAVEL_MODE;
}

function buildRouteContext(selectedCities, days) {
  const isLinearTrip = selectedCities.length > 1;
  const originCity = selectedCities[0] || '';
  const destinationCity = isLinearTrip ? selectedCities[selectedCities.length - 1] : originCity;

  return {
    type: isLinearTrip ? 'linear_multi_city_drive' : 'single_destination',
    selectedCityOrder: selectedCities,
    originCity,
    destinationCity,
    mustPreserveCityOrder: isLinearTrip,
    mustEndAtDestination: isLinearTrip,
    avoidReturningToEarlierCities: isLinearTrip,
    allowIntermediateStopsAlongDrivingCorridor: isLinearTrip && days > selectedCities.length,
    instruction: isLinearTrip
      ? `Create a one-way driving itinerary from ${originCity} to ${destinationCity}. Use the selected city order as the route direction and never bounce back to a previous city.`
      : `Create a coherent itinerary centred on ${originCity || 'the selected city'}.`,
  };
}

function buildOpenAIInput(input = {}, options = {}) {
  const days = getTripDuration(input.selectedDays);
  const selectedCountries = normalizeList(input.selectedCountries, 8, 80);
  const selectedCities = normalizeList(input.selectedCities, 12, 80);
  const selectedAttractions = normalizeList(input.selectedAttractions, 16, 80);
  const preferredInterests = normalizeList(options.userPreferences?.favoriteInterests, 12, 80);
  const stopsTarget = getStopsTarget(days, options);
  const routeContext = buildRouteContext(selectedCities, days);

  return {
    request: {
      generalQuery: normalizeOptionalText(input.generalQuery, 500) || 'Create a balanced itinerary for a first-time visitor.',
      selectedCountries,
      selectedCities,
      selectedAttractions,
      selectedDays: days,
      travelMode: getTravelMode(options),
      language: DEFAULT_LANGUAGE,
      routeContext,
    },
    userPreferences: {
      travelPace: normalizeOptionalText(options.userPreferences?.travelPace, 40) || 'balanced',
      budget: normalizeOptionalText(options.userPreferences?.budget, 40) || 'flexible',
      walkingTolerance: normalizeOptionalText(options.userPreferences?.walkingTolerance, 40) || 'medium',
      favoriteInterests: preferredInterests,
      notes: normalizeOptionalText(options.userPreferences?.notes, 300),
    },
    outputRequirements: {
      maxDays: MAX_ITINERARY_DAYS,
      minStopsTotal: stopsTarget.min,
      maxStopsTotal: stopsTarget.max,
      maxActivitiesPerDay: options.compactOutput ? 3 : MAX_ACTIVITIES_PER_DAY,
      includeFoodStops: true,
      includeReasons: true,
      optimisedForGoogleMaps: true,
      includePlaceQueries: true,
      compactOutput: Boolean(options.compactOutput),
    },
  };
}

function formatStructuredOutput() {
  return {
    type: 'json_schema',
    name: 'travel_itinerary_generation',
    strict: true,
    schema: openAIItinerarySchema,
  };
}

function formatChatStructuredOutput() {
  return {
    name: 'travel_itinerary_generation',
    strict: true,
    schema: openAIItinerarySchema,
  };
}

function buildOpenAIResponsesRequest(input, options = {}) {
  return {
    model: appConfig.ai.openaiModel,
    instructions: ITINERARY_DEVELOPER_PROMPT,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: JSON.stringify(buildOpenAIInput(input, options)),
          },
        ],
      },
    ],
    text: {
      format: formatStructuredOutput(),
    },
    max_output_tokens: options.maxOutputTokens || DEFAULT_MAX_OUTPUT_TOKENS,
    store: false,
  };
}

function buildOpenAIChatRequest(input, options = {}) {
  return {
    model: appConfig.ai.openaiModel,
    messages: [
      { role: 'system', content: ITINERARY_DEVELOPER_PROMPT },
      { role: 'user', content: JSON.stringify(buildOpenAIInput(input, options)) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: formatChatStructuredOutput(),
    },
    max_tokens: options.maxOutputTokens || DEFAULT_MAX_OUTPUT_TOKENS,
    temperature: 0.15,
  };
}

function shouldRetryAfterParseError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('json') || message.includes('unexpected') || message.includes('expected') || message.includes('unterminated');
}

function extractJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('The AI provider returned an empty response.');
  }

  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('The AI provider response did not contain a JSON object.');
  }

  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

function extractResponsesText(responseData = {}) {
  if (responseData.status === 'incomplete') {
    throw new Error(`OpenAI response was incomplete: ${responseData.incomplete_details?.reason || 'unknown reason'}.`);
  }

  if (typeof responseData.output_text === 'string' && responseData.output_text.trim()) {
    return responseData.output_text;
  }

  const outputs = Array.isArray(responseData.output) ? responseData.output : [];
  const textParts = [];
  const refusals = [];

  outputs.forEach((item) => {
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((contentItem) => {
      if (contentItem?.type === 'output_text' && typeof contentItem.text === 'string') {
        textParts.push(contentItem.text);
      }
      if (contentItem?.type === 'refusal' && typeof contentItem.refusal === 'string') {
        refusals.push(contentItem.refusal);
      }
    });
  });

  if (textParts.length > 0) {
    return textParts.join('\n');
  }

  if (refusals.length > 0) {
    throw new Error(`OpenAI refused the itinerary request: ${refusals.join(' ')}`);
  }

  throw new Error('OpenAI returned no structured output text.');
}

async function callOpenAIResponses(input, options = {}) {
  const response = await axios.post(
    OPENAI_RESPONSES_ENDPOINT,
    buildOpenAIResponsesRequest(input, options),
    {
      headers: {
        Authorization: `Bearer ${appConfig.ai.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: getAiTimeout(),
    }
  );

  return extractResponsesText(response.data);
}

async function callOpenAIChatCompletions(input, options = {}) {
  const response = await axios.post(
    OPENAI_CHAT_COMPLETIONS_ENDPOINT,
    buildOpenAIChatRequest(input, options),
    {
      headers: {
        Authorization: `Bearer ${appConfig.ai.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: getAiTimeout(),
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned no message content.');
  }

  return content;
}

function isRecoverableResponsesApiError(error) {
  const status = error?.response?.status;
  const message = String(error?.response?.data?.error?.message || error?.message || '').toLowerCase();

  return status === 400 && (
    message.includes('unsupported') ||
    message.includes('unrecognized') ||
    message.includes('unknown parameter') ||
    message.includes('invalid type') ||
    message.includes('json_schema')
  );
}

async function callOpenAI(input, options = {}) {
  if (!appConfig.ai.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required when TRAVEL_AI_PROVIDER=openai.');
  }

  try {
    return await callOpenAIResponses(input, options);
  } catch (error) {
    if (!isRecoverableResponsesApiError(error)) {
      throw error;
    }

    logServerWarning('OpenAI Responses API unavailable for this model/request; trying Chat Completions structured output.', {
      model: appConfig.ai.openaiModel,
      status: error.response?.status,
      message: error.response?.data?.error?.message || error.message,
    });
    return callOpenAIChatCompletions(input, options);
  }
}

async function getProviderResponse(provider, input, options = {}) {
  if (provider === 'openai') {
    return callOpenAI(input, options);
  }

  return null;
}

function normalizePeriod(value) {
  const period = normalizeText(value, 30).toLowerCase();
  return ['morning', 'lunch', 'afternoon', 'evening', 'flexible'].includes(period) ? period : 'flexible';
}

function normalizeDuration(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  return Math.min(Math.max(Math.round(duration), 15), 480);
}

function normalizeActivity(activity) {
  if (typeof activity === 'string') {
    const text = normalizeText(activity, 300);
    return text ? { label: text } : null;
  }

  if (!activity || typeof activity !== 'object') {
    return null;
  }

  const name = normalizeText(activity.name || activity.title || activity.place, 140);
  const placeQuery = normalizeText(activity.placeQuery || activity.mapsSearchHint || activity.address || name, 220);
  const address = normalizeOptionalText(activity.address || activity.location || activity.formattedAddress, 220);
  const city = normalizeOptionalText(activity.city, 120);
  const country = normalizeOptionalText(activity.country, 120);
  const period = normalizePeriod(activity.period);
  const category = normalizeOptionalText(activity.category, 80) || 'other';
  const durationMinutes = normalizeDuration(activity.durationMinutes);
  const reason = normalizeOptionalText(activity.reason || activity.description || activity.explanation, 260);
  const mapsSearchHint = normalizeText(activity.mapsSearchHint || placeQuery || name, 220);

  if (!name && !placeQuery) {
    return null;
  }

  return {
    period,
    name: name || placeQuery,
    placeQuery: placeQuery || name,
    address,
    city,
    country,
    category,
    durationMinutes,
    reason,
    mapsSearchHint,
    label: formatActivityLabel({ period, name: name || placeQuery, address, durationMinutes, reason }),
  };
}

function formatActivityLabel(activity = {}) {
  const periodLabel = activity.period && activity.period !== 'flexible'
    ? `${activity.period[0].toUpperCase()}${activity.period.slice(1)}: `
    : '';
  const location = activity.address ? ` (${activity.address})` : '';
  const duration = activity.durationMinutes ? ` · ${activity.durationMinutes} min` : '';
  const reason = activity.reason ? ` — ${activity.reason}` : '';
  return normalizeText(`${periodLabel}${activity.name || 'Stop'}${location}${duration}${reason}`, 360);
}

function normalizeItineraryDay(day, index) {
  if (!day || typeof day !== 'object') {
    return null;
  }

  const activityDetails = Array.isArray(day.activities)
    ? day.activities.map(normalizeActivity).filter(Boolean).slice(0, MAX_ACTIVITIES_PER_DAY)
    : [];

  if (activityDetails.length === 0) {
    return null;
  }

  return {
    day: Number.isInteger(Number(day.day)) ? Number(day.day) : index + 1,
    title: normalizeOptionalText(day.title, 160),
    city: normalizeText(day.city, 120),
    summary: normalizeOptionalText(day.summary, 300),
    activities: activityDetails.map((activity) => activity.label).filter(Boolean),
    activityDetails,
  };
}

function normalizeKey(value = '') {
  return normalizeText(value, 160).toLowerCase();
}

function getActivityMonumentKey(activity = {}) {
  return normalizeKey(activity.placeQuery || activity.mapsSearchHint || activity.name || activity.address);
}

function getMonumentKey(monument = {}) {
  return normalizeKey(monument.placeQuery || monument.mapsSearchHint || monument.name || monument.address);
}

function buildMonumentLookup(monuments = []) {
  const lookup = new Map();
  monuments.forEach((monument) => {
    [monument.placeQuery, monument.mapsSearchHint, monument.name, monument.address]
      .map(normalizeKey)
      .filter(Boolean)
      .forEach((key) => {
        if (!lookup.has(key)) {
          lookup.set(key, monument);
        }
      });
  });
  return lookup;
}

function activityToMonument(activity = {}, fallback = null) {
  const base = fallback || {};
  const name = normalizeText(activity.name || base.name || activity.placeQuery || base.placeQuery, 140);
  const placeQuery = normalizeText(activity.placeQuery || base.placeQuery || activity.mapsSearchHint || name, 220);
  const address = normalizeOptionalText(activity.address || base.address, 220);

  if (!name && !placeQuery && !address) {
    return null;
  }

  return {
    name: name || placeQuery || address,
    placeQuery: placeQuery || name || address,
    mapsSearchHint: normalizeText(activity.mapsSearchHint || base.mapsSearchHint || placeQuery || name || address, 220),
    address,
    city: normalizeOptionalText(activity.city || base.city, 120),
    country: normalizeOptionalText(activity.country || base.country, 120),
    category: normalizeOptionalText(activity.category || base.category, 80),
    tags: Array.isArray(base.tags) && base.tags.length > 0 ? base.tags : normalizeList([activity.category].filter(Boolean), 4, 60),
    durationMinutes: normalizeDuration(activity.durationMinutes || base.durationMinutes),
    reason: normalizeOptionalText(activity.reason || base.reason, 260),
    coordinates: base.coordinates || null,
  };
}

function rankCityForRoute(city = '', selectedCities = []) {
  if (selectedCities.length < 2) {
    return 0;
  }

  const normalizedCity = normalizeKey(city);
  if (!normalizedCity) {
    return Math.max(1, selectedCities.length - 1);
  }

  const directIndex = selectedCities.findIndex((selectedCity) => normalizeKey(selectedCity) === normalizedCity);
  if (directIndex >= 0) {
    return directIndex * 2;
  }

  return Math.max(1, (selectedCities.length - 1) * 2 - 1);
}

function sortItineraryForRouteContext(itinerary = [], input = {}) {
  const selectedCities = normalizeList(input.selectedCities, 12, 80);
  if (selectedCities.length < 2) {
    return itinerary;
  }

  return [...itinerary]
    .map((day, index) => ({ day, index, rank: rankCityForRoute(day.city, selectedCities) }))
    .sort((a, b) => (a.rank - b.rank) || (a.index - b.index))
    .map(({ day }, index) => ({
      ...day,
      day: index + 1,
    }));
}

function buildChronologicalMonuments(itinerary = [], normalizedMonuments = []) {
  const lookup = buildMonumentLookup(normalizedMonuments);
  const seen = new Set();
  const monuments = [];

  itinerary.forEach((day) => {
    const activities = Array.isArray(day.activityDetails) ? day.activityDetails : [];
    activities.forEach((activity) => {
      const key = getActivityMonumentKey(activity);
      const fallback = lookup.get(key) || null;
      const monument = activityToMonument(activity, fallback);
      if (!monument) {
        return;
      }

      const dedupeKey = getMonumentKey(monument);
      if (dedupeKey && seen.has(dedupeKey)) {
        return;
      }
      if (dedupeKey) {
        seen.add(dedupeKey);
      }
      monuments.push(monument);
    });
  });

  return monuments.slice(0, MAX_MONUMENTS);
}

function normalizeMonumentObject(monument) {
  if (typeof monument === 'string') {
    return normalizeText(monument);
  }

  if (!monument || typeof monument !== 'object') {
    return null;
  }

  const name = normalizeText(monument.name || monument.title || monument.place, 140);
  const placeQuery = normalizeText(monument.placeQuery || monument.mapsSearchHint || monument.address || monument.location || name, 220);
  const address = normalizeOptionalText(monument.address || monument.location || monument.formattedAddress, 220);

  if (!name && !address && !placeQuery) {
    return null;
  }

  return {
    name: name || address || placeQuery,
    placeQuery: placeQuery || name || address,
    mapsSearchHint: normalizeText(monument.mapsSearchHint || placeQuery || name || address, 220),
    address,
    city: normalizeOptionalText(monument.city, 120),
    country: normalizeOptionalText(monument.country, 120),
    category: normalizeOptionalText(monument.category, 80),
    tags: normalizeList(monument.tags, 8, 60),
    durationMinutes: normalizeDuration(monument.durationMinutes),
    reason: normalizeOptionalText(monument.reason || monument.description || monument.explanation, 260),
    coordinates: monument.coordinates || null,
  };
}

function normalizeRecommendation(recommendation, fallbackStops) {
  if (!recommendation || typeof recommendation !== 'object') {
    return null;
  }

  const title = normalizeOptionalText(recommendation.title, 160);
  const summary = normalizeOptionalText(recommendation.summary || recommendation.description, 360);

  return {
    title,
    summary,
    bestFor: normalizeList(recommendation.bestFor, 6, 80),
    pace: normalizeOptionalText(recommendation.pace || recommendation.travelPace, 40),
    estimatedStops: Number.isInteger(Number(recommendation.estimatedStops))
      ? Number(recommendation.estimatedStops)
      : fallbackStops,
  };
}

function normalizeGeneratedPayload(payload, input = {}) {
  const itinerary = Array.isArray(payload?.itinerary)
    ? payload.itinerary.map(normalizeItineraryDay).filter(Boolean).slice(0, MAX_ITINERARY_DAYS)
    : [];
  const routeOrderedItinerary = sortItineraryForRouteContext(itinerary, input);

  const providerMonuments = Array.isArray(payload?.monuments)
    ? payload.monuments.map(normalizeMonumentObject).filter(Boolean).slice(0, MAX_MONUMENTS)
    : [];
  const chronologicalMonuments = buildChronologicalMonuments(routeOrderedItinerary, providerMonuments);
  const monuments = chronologicalMonuments.length > 0 ? chronologicalMonuments : providerMonuments;

  return {
    itinerary: routeOrderedItinerary,
    monuments,
    recommendation: normalizeRecommendation(payload?.recommendation, monuments.length),
  };
}

function generateLocalFallback(input, options = {}, provider = 'mock', reason = '') {
  return {
    provider: provider === 'mock' ? provider : `${provider}-fallback-local-scoring-v1`,
    providerInfo: {
      aiProvider: provider,
      model: provider === 'openai' ? appConfig.ai.openaiModel : provider,
      usedFallback: provider !== 'mock',
      fallbackReason: normalizeOptionalText(reason, 220),
    },
    ...generateRecommendationPlan(input, options.userPreferences),
  };
}

function logProviderFallback(provider, error) {
  logServerWarning('AI provider unavailable; using local recommendation fallback.', {
    provider,
    message: error?.response?.data?.error?.message || error?.message,
    code: error?.code,
    status: error?.response?.status,
  });
}

async function getNormalizedProviderPayload(provider, input, options = {}) {
  const rawContent = await getProviderResponse(provider, input, options);
  const parsed = extractJson(rawContent);
  return normalizeGeneratedPayload(parsed, input);
}

async function generateTravelItinerary(input, options = {}) {
  const provider = getProvider();

  if (provider === 'mock') {
    return generateLocalFallback(input, options, provider);
  }

  try {
    let normalizedPayload;
    try {
      normalizedPayload = await getNormalizedProviderPayload(provider, input, {
        ...options,
        maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
      });
    } catch (parseOrProviderError) {
      if (!shouldRetryAfterParseError(parseOrProviderError)) {
        throw parseOrProviderError;
      }

      logServerWarning('OpenAI response was not valid JSON; retrying with a compact itinerary schema budget.', {
        provider,
        model: appConfig.ai.openaiModel,
        message: parseOrProviderError.message,
      });
      normalizedPayload = await getNormalizedProviderPayload(provider, input, {
        ...options,
        compactOutput: true,
        maxOutputTokens: RETRY_MAX_OUTPUT_TOKENS,
      });
    }

    if (normalizedPayload.itinerary.length === 0 || normalizedPayload.monuments.length === 0) {
      return generateLocalFallback(input, options, provider, 'OpenAI returned an empty itinerary.');
    }

    return {
      provider,
      providerInfo: {
        aiProvider: provider,
        model: appConfig.ai.openaiModel,
        usedFallback: false,
        fallbackReason: '',
      },
      ...normalizedPayload,
    };
  } catch (error) {
    logProviderFallback(provider, error);
    return generateLocalFallback(input, options, provider, error?.response?.data?.error?.message || error?.message || 'OpenAI request failed.');
  }
}

module.exports = {
  buildOpenAIInput,
  buildOpenAIResponsesRequest,
  extractResponsesText,
  generateTravelItinerary,
  normalizeGeneratedPayload,
};
