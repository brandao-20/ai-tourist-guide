const axios = require('axios');

const SUPPORTED_PROVIDERS = ['mock', 'ollama', 'openai'];

function getProvider() {
  const provider = (process.env.TRAVEL_AI_PROVIDER || 'mock').toLowerCase();
  return SUPPORTED_PROVIDERS.includes(provider) ? provider : 'mock';
}

function buildTravelPrompt({ generalQuery, selectedCountries, selectedCities, selectedAttractions, selectedDays }) {
  const days = Array.isArray(selectedDays) && selectedDays.length > 0
    ? parseInt(selectedDays[0], 10)
    : parseInt(selectedDays, 10) || 3;

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

async function callOpenAI(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required when TRAVEL_AI_PROVIDER=openai.');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
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
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.choices[0].message.content;
}

async function callOllama(prompt) {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3.1:8b';

  const response = await axios.post(`${baseUrl}/api/generate`, {
    model,
    prompt,
    stream: false,
    format: 'json',
  });

  return response.data.response;
}

function buildMockResponse({ selectedCities, selectedAttractions, selectedDays }) {
  const days = Array.isArray(selectedDays) && selectedDays.length > 0
    ? parseInt(selectedDays[0], 10)
    : parseInt(selectedDays, 10) || 3;

  const cities = selectedCities.length > 0 ? selectedCities : ['Lisbon'];
  const attractionLabel = selectedAttractions.length > 0 ? selectedAttractions[0] : 'historic center';

  const itinerary = Array.from({ length: Math.max(days, 1) }, (_, index) => {
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
    monuments: itinerary.flatMap(day => day.activities.filter(activity => activity.startsWith('Explore') || activity.startsWith('Walk'))),
  });
}

async function generateTravelItinerary(input) {
  const provider = getProvider();
  const prompt = buildTravelPrompt(input);

  let rawContent;

  if (provider === 'openai') {
    rawContent = await callOpenAI(prompt);
  } else if (provider === 'ollama') {
    rawContent = await callOllama(prompt);
  } else {
    rawContent = buildMockResponse(input);
  }

  const parsed = extractJson(rawContent);

  return {
    provider,
    rawContent,
    itinerary: Array.isArray(parsed.itinerary) ? parsed.itinerary : [],
    monuments: Array.isArray(parsed.monuments) ? parsed.monuments : [],
  };
}

module.exports = {
  generateTravelItinerary,
};
