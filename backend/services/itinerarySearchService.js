const { appConfig } = require('../config/env');
const { generateTravelItinerary } = require('./aiService');
const { geocodeAddress } = require('./geocodingService');
const { searchPlacesByText } = require('./googlePlacesService');
const { computeRouteMetadata } = require('./googleRoutesService');

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
    const placeQuery = normalizeMonumentText(monument.placeQuery || monument.mapsSearchHint || monument.searchQuery);

    return {
      name,
      address,
      placeQuery,
      mapsSearchHint: normalizeMonumentText(monument.mapsSearchHint || placeQuery, 220),
      city: normalizeMonumentText(monument.city, 120),
      country: normalizeMonumentText(monument.country, 120),
      category: normalizeMonumentText(monument.category, 80),
      tags: Array.isArray(monument.tags) ? monument.tags.map((tag) => normalizeMonumentText(tag, 60)).filter(Boolean).slice(0, 8) : [],
      durationMinutes: Number.isFinite(Number(monument.durationMinutes)) ? Number(monument.durationMinutes) : null,
      reason: normalizeMonumentText(monument.reason, 240),
      coordinates: normalizeCoordinates(monument.coordinates || monument.locationCoordinates),
      source: normalizeMonumentText(monument.source, 80),
    };
  }

  return null;
}

function getCountryContext(searchPayload = {}) {
  return Array.isArray(searchPayload.selectedCountries) ? searchPayload.selectedCountries.filter(Boolean).join(', ') : '';
}

function getCityContext(searchPayload = {}) {
  return Array.isArray(searchPayload.selectedCities) ? searchPayload.selectedCities.filter(Boolean).join(', ') : '';
}

function buildPlaceSearchQuery(monument, searchPayload = {}) {
  const parts = [
    monument.placeQuery,
    monument.mapsSearchHint,
    monument.name,
    monument.address,
    monument.city,
    monument.country,
    getCityContext(searchPayload),
    getCountryContext(searchPayload),
  ].filter(Boolean);

  const seen = new Set();
  return parts
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .join(', ');
}

function mergeGooglePlace(monument, place) {
  if (!place) {
    return monument;
  }

  return {
    ...monument,
    name: place.name || monument.name,
    address: place.address || monument.address,
    coordinates: place.coordinates || monument.coordinates,
    placeQuery: monument.placeQuery || place.name || monument.name,
    mapsSearchHint: monument.mapsSearchHint || monument.placeQuery || place.name || monument.name,
    category: monument.category || place.type || '',
    tags: monument.tags?.length ? monument.tags : place.types || [],
    rating: place.rating || null,
    placeId: place.placeId || null,
    googleMapsUri: place.googleMapsUri || '',
    source: 'google-places-api',
  };
}

async function enrichWithGooglePlace(monument, searchPayload) {
  if (!appConfig.googlePlaces.enrichItineraries) {
    return monument;
  }

  const query = buildPlaceSearchQuery(monument, searchPayload);
  if (!query) {
    return monument;
  }

  const result = await searchPlacesByText(query, { limit: 1 });
  if (!result.configured || result.places.length === 0) {
    return monument;
  }

  return mergeGooglePlace(monument, result.places[0]);
}

async function addCoordinates(monument, searchPayload = {}, options = {}) {
  if (!monument || !monument.name) {
    return null;
  }

  let resolvedMonument = monument;
  if (options.usePlaces) {
    resolvedMonument = await enrichWithGooglePlace(resolvedMonument, searchPayload);
  }

  if (resolvedMonument.coordinates || !resolvedMonument.address) {
    return resolvedMonument;
  }

  const coordinates = await geocodeAddress(resolvedMonument.address);
  return {
    ...resolvedMonument,
    coordinates,
    source: coordinates ? (resolvedMonument.source || 'google-geocoding-api') : resolvedMonument.source,
  };
}

async function buildMonumentsWithCoordinates(monuments, searchPayload = {}) {
  if (!Array.isArray(monuments)) {
    return [];
  }

  const normalizedMonuments = monuments
    .slice(0, MAX_MONUMENTS_TO_PROCESS)
    .map(normalizeMonument)
    .filter(Boolean);

  const enrichedMonuments = [];
  const placeEnrichmentLimit = appConfig.googlePlaces.enrichmentLimit;

  for (const [index, monument] of normalizedMonuments.entries()) {
    const usePlaces = index < placeEnrichmentLimit;
    const enrichedMonument = await addCoordinates(monument, searchPayload, { usePlaces });
    if (enrichedMonument) {
      enrichedMonuments.push(enrichedMonument);
    }
  }

  const monumentsWithCoordinates = enrichedMonuments.filter((monument) => monument.coordinates !== null);

  return monumentsWithCoordinates.length > 0 ? monumentsWithCoordinates : enrichedMonuments;
}

function resolveRouteTravelMode(userPreferences = null) {
  const configuredMode = userPreferences?.transportMode;
  if (configuredMode === 'walking' || configuredMode === 'transit') {
    return configuredMode;
  }

  return 'driving';
}

function getApiSourceSummary(monuments, routeMetadata, aiResult = {}) {
  return {
    googlePlaces: {
      enabled: Boolean(appConfig.googlePlaces.apiKey),
      used: monuments.some((monument) => monument.source === 'google-places-api'),
    },
    googleRoutes: {
      enabled: Boolean(appConfig.googleRoutes.apiKey),
      used: Boolean(routeMetadata),
    },
    openai: {
      enabled: appConfig.ai.provider === 'openai',
      usedFallback: Boolean(aiResult.providerInfo?.usedFallback),
      model: aiResult.providerInfo?.model || appConfig.ai.openaiModel,
    },
  };
}

async function runItinerarySearch(searchPayload, options = {}) {
  const aiResult = await generateTravelItinerary(searchPayload, {
    userPreferences: options.userPreferences || null,
  });
  const monuments = await buildMonumentsWithCoordinates(aiResult.monuments, searchPayload);
  const routeResult = await computeRouteMetadata(monuments, {
    travelMode: resolveRouteTravelMode(options.userPreferences),
  });

  return {
    provider: aiResult.provider,
    itinerary: aiResult.itinerary,
    monuments,
    routeMetadata: routeResult.metadata,
    recommendation: aiResult.recommendation || null,
    apiSources: getApiSourceSummary(monuments, routeResult.metadata, aiResult),
    providerInfo: aiResult.providerInfo || null,
  };
}

module.exports = {
  runItinerarySearch,
  buildMonumentsWithCoordinates,
};
