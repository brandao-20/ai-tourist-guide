const axios = require('axios');
const { appConfig } = require('../config/env');

const MAX_ITINERARY_DAYS = 30;
const MAX_ACTIVITIES_PER_DAY = 8;
const MAX_MONUMENTS = 40;
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
    "place name (full address, city, country)"
  ]
}

Rules:
- Include complete addresses whenever possible.
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

function normalizeGeneratedPayload(payload) {
  const itinerary = Array.isArray(payload?.itinerary)
    ? payload.itinerary.map(normalizeItineraryDay).filter(Boolean).slice(0, MAX_ITINERARY_DAYS)
    : [];

  const monuments = Array.isArray(payload?.monuments)
    ? payload.monuments.map((monument) => normalizeText(monument)).filter(Boolean).slice(0, MAX_MONUMENTS)
    : [];

  return { itinerary, monuments };
}

async function callOpenAI(prompt) {
  if (!appConfig.ai.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required when TRAVEL_AI_PROVIDER=openai.');
  }

  const model = appConfig.ai.openaiModel;
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.7,
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

async function callOllama(prompt) {
  const baseUrl = appConfig.ai.ollamaBaseUrl;
  const model = appConfig.ai.ollamaModel;

  const response = await axios.post(
    `${baseUrl}/api/generate`,
    {
      model,
      prompt,
      stream: false,
      format: 'json',
    },
    { timeout: getAiTimeout() }
  );

  if (!response.data?.response) {
    throw new Error('Ollama returned no response content.');
  }

  return response.data.response;
}

function buildMockResponse({ selectedCities, selectedAttractions, selectedDays }) {
  const days = getTripDuration(selectedDays);
  const cities = selectedCities.length > 0 ? selectedCities : ['Lisbon'];
  const attractionLabel = selectedAttractions.length > 0 ? selectedAttractions[0] : 'historic center';

  const itinerary = Array.from({ length: days }, (_, index) => {
    const city = cities[index % cities.length];
    return {
      day: index + 1,
      city,
      activities: [
        `Explore ${attractionLabel} in ${city} (${city}, Portugal)`,
        `Lunch in the city center (${city}, Portugal)`,
        `Walk through the main viewpoint or cultural area (${city}, Portugal)`,
      ],
    };
  });

  return JSON.stringify({
    itinerary,
    monuments: itinerary.flatMap((day) => day.activities.filter((activity) => (
      activity.startsWith('Explore') || activity.startsWith('Walk')
    ))),
  });
}

async function getProviderResponse(provider, prompt, input) {
  if (provider === 'openai') {
    return callOpenAI(prompt);
  }

  if (provider === 'ollama') {
    return callOllama(prompt);
  }

  return buildMockResponse(input);
}

async function generateTravelItinerary(input) {
  const provider = getProvider();
  const prompt = buildTravelPrompt(input);
  const rawContent = await getProviderResponse(provider, prompt, input);
  const parsed = extractJson(rawContent);
  const normalizedPayload = normalizeGeneratedPayload(parsed);

  return {
    provider,
    ...normalizedPayload,
  };
}

module.exports = {
  generateTravelItinerary,
};
