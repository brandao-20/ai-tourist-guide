const axios = require('axios');
const { appConfig } = require('../config/env');
const { generateRecommendationPlan } = require('./recommendationEngineService');

const MAX_ITINERARY_DAYS = 14;
const MAX_ACTIVITIES_PER_DAY = 6;
const MAX_MONUMENTS = 24;
const MAX_TEXT_LENGTH = 240;

function getProvider() {
  return appConfig.ai.provider;
}

function getAiTimeout() {
  return appConfig.ai.timeoutMs;
}

function normalizeText(value, maxLength = MAX_TEXT_LENGTH) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
    : '';
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

function buildTravelPrompt({ generalQuery, selectedCountries, selectedCities, selectedAttractions, selectedDays }) {
  const days = getTripDuration(selectedDays);

  return `You are a travel planning assistant. Create a practical itinerary in JSON only.

User request: "${generalQuery}"
Countries: ${selectedCountries.join(', ')}
Cities: ${selectedCities.join(', ')}
Preferred attraction types or places: ${selectedAttractions.join(', ')}
Trip duration: ${days} days

Return only valid JSON, with no markdown and no extra text, using this structure:
{
  "itinerary": [
    {
      "day": 1,
      "city": "city name",
      "activities": [
        "Visit place name (full address, city, country)",
        "Lunch at place name (full address, city, country)"
      ]
    }
  ],
  "monuments": [
    {
      "name": "place name",
      "address": "full address, city, country",
      "city": "city name",
      "category": "category",
      "reason": "short explanation"
    }
  ]
}

Rules:
- Include complete addresses whenever possible.
- Prefer real, specific places instead of generic labels.
- Do not repeat the same stop unless it is essential.
- Keep the route stops realistic for Google Maps routing.
- Distribute activities across the selected cities.
- Include food stops when useful.
- Keep the number of places realistic for the selected duration.`;
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

function normalizeItineraryDay(day, index) {
  if (!day || typeof day !== 'object') {
    return null;
  }

  const activities = Array.isArray(day.activities)
    ? day.activities.map((activity) => normalizeText(activity)).filter(Boolean).slice(0, MAX_ACTIVITIES_PER_DAY)
    : [];

  if (activities.length === 0) {
    return null;
  }

  return {
    day: Number.isInteger(Number(day.day)) ? Number(day.day) : index + 1,
    city: normalizeText(day.city, 120),
    activities,
  };
}

function normalizeMonumentObject(monument) {
  if (typeof monument === 'string') {
    return normalizeText(monument);
  }

  if (!monument || typeof monument !== 'object') {
    return null;
  }

  const name = normalizeText(monument.name || monument.title || monument.place, 140);
  const address = normalizeText(monument.address || monument.location || monument.formattedAddress, 200);

  if (!name && !address) {
    return null;
  }

  return {
    name: name || address,
    address,
    city: normalizeText(monument.city, 120),
    category: normalizeText(monument.category, 80),
    tags: Array.isArray(monument.tags) ? monument.tags.map((tag) => normalizeText(tag, 60)).filter(Boolean).slice(0, 8) : [],
    durationMinutes: Number.isFinite(Number(monument.durationMinutes)) ? Number(monument.durationMinutes) : null,
    reason: normalizeText(monument.reason, 240),
    coordinates: monument.coordinates || null,
  };
}

function normalizeGeneratedPayload(payload) {
  const itinerary = Array.isArray(payload?.itinerary)
    ? payload.itinerary.map(normalizeItineraryDay).filter(Boolean).slice(0, MAX_ITINERARY_DAYS)
    : [];

  const monuments = Array.isArray(payload?.monuments)
    ? payload.monuments.map(normalizeMonumentObject).filter(Boolean).slice(0, MAX_MONUMENTS)
    : [];

  return {
    itinerary,
    monuments,
    recommendation: payload?.recommendation && typeof payload.recommendation === 'object'
      ? payload.recommendation
      : null,
  };
}

async function callOpenAI(prompt) {
  if (!appConfig.ai.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required when TRAVEL_AI_PROVIDER=openai.');
  }

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: appConfig.ai.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1800,
      temperature: 0.55,
    },
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

async function getProviderResponse(provider, prompt) {
  if (provider === 'openai') {
    return callOpenAI(prompt);
  }

  return null;
}

async function generateTravelItinerary(input, options = {}) {
  const provider = getProvider();

  if (provider === 'mock') {
    return {
      provider,
      ...generateRecommendationPlan(input, options.userPreferences),
    };
  }

  const prompt = buildTravelPrompt(input);
  const rawContent = await getProviderResponse(provider, prompt);
  const parsed = extractJson(rawContent);
  const normalizedPayload = normalizeGeneratedPayload(parsed);

  if (normalizedPayload.itinerary.length === 0 || normalizedPayload.monuments.length === 0) {
    return {
      provider: `${provider}-fallback-local-scoring-v1`,
      ...generateRecommendationPlan(input, options.userPreferences),
    };
  }

  return {
    provider,
    ...normalizedPayload,
  };
}

module.exports = {
  generateTravelItinerary,
  normalizeGeneratedPayload,
};
