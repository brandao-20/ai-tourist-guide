const { generateTravelItinerary } = require('./aiService');
const { geocodeAddress } = require('./geocodingService');

const MAX_MONUMENTS_TO_PROCESS = 30;
const MAX_MONUMENT_TEXT_LENGTH = 240;

function normalizeMonumentText(value) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, MAX_MONUMENT_TEXT_LENGTH)
    : '';
}

function hasValidCoordinates(coordinates) {
  return coordinates &&
    Number.isFinite(Number(coordinates.lat)) &&
    Number.isFinite(Number(coordinates.lng));
}

function normalizeCoordinates(coordinates) {
  if (!hasValidCoordinates(coordinates)) {
    return null;
  }

  return {
    lat: Number(coordinates.lat),
    lng: Number(coordinates.lng),
  };
}

function parseMonumentString(monument) {
  const text = normalizeMonumentText(monument);
  const match = text.match(/^(.*?)\s*\((.*)\)$/);

  if (!match) {
    return {
      name: text,
      address: '',
      coordinates: null,
    };
  }

  return {
    name: normalizeMonumentText(match[1]),
    address: normalizeMonumentText(match[2]),
    coordinates: null,
  };
}

function normalizeMonument(monument) {
  if (typeof monument === 'string') {
    return parseMonumentString(monument);
  }

  if (monument && typeof monument === 'object') {
    const name = normalizeMonumentText(monument.name || monument.title || monument.place);
    const address = normalizeMonumentText(monument.address || monument.location || monument.formattedAddress);

    return {
      name,
      address,
      coordinates: normalizeCoordinates(monument.coordinates || monument.locationCoordinates),
    };
  }

  return null;
}

async function addCoordinates(monument) {
  if (!monument || !monument.name) {
    return null;
  }

  if (monument.coordinates || !monument.address) {
    return monument;
  }

  const coordinates = await geocodeAddress(monument.address);
  return {
    ...monument,
    coordinates,
  };
}

async function buildMonumentsWithCoordinates(monuments) {
  if (!Array.isArray(monuments)) {
    return [];
  }

  const normalizedMonuments = monuments
    .slice(0, MAX_MONUMENTS_TO_PROCESS)
    .map(normalizeMonument)
    .filter(Boolean);

  const enrichedMonuments = await Promise.all(normalizedMonuments.map(addCoordinates));
  const safeMonuments = enrichedMonuments.filter(Boolean);
  const monumentsWithCoordinates = safeMonuments.filter((monument) => monument.coordinates !== null);

  return monumentsWithCoordinates.length > 0 ? monumentsWithCoordinates : safeMonuments;
}

async function runItinerarySearch(searchPayload) {
  const aiResult = await generateTravelItinerary(searchPayload);
  const monuments = await buildMonumentsWithCoordinates(aiResult.monuments);

  return {
    provider: aiResult.provider,
    itinerary: aiResult.itinerary,
    monuments,
  };
}

module.exports = {
  runItinerarySearch,
  buildMonumentsWithCoordinates,
};
