const axios = require('axios');
const { appConfig } = require('../config/env');

const PLACES_TEXT_SEARCH_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

function isGooglePlacesConfigured() {
  return Boolean(appConfig.googlePlaces.apiKey);
}

async function searchPlacesByText(query, options = {}) {
  if (!isGooglePlacesConfigured()) {
    return { configured: false, places: [] };
  }

  const textQuery = typeof query === 'string' ? query.trim() : '';
  if (!textQuery) {
    return { configured: true, places: [] };
  }

  const payload = {
    textQuery,
    languageCode: 'en',
    maxResultCount: Math.min(Math.max(Number(options.limit) || 5, 1), 10),
  };

  const response = await axios.post(PLACES_TEXT_SEARCH_ENDPOINT, payload, {
    timeout: appConfig.googlePlaces.timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': appConfig.googlePlaces.apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.location,places.primaryType,places.photos',
    },
  });

  const places = Array.isArray(response.data?.places) ? response.data.places : [];

  return {
    configured: true,
    places: places.map((place) => ({
      id: place.id,
      name: place.displayName?.text || '',
      address: place.formattedAddress || '',
      rating: place.rating || null,
      type: place.primaryType || '',
      coordinates: place.location
        ? { lat: place.location.latitude, lng: place.location.longitude }
        : null,
    })),
  };
}

module.exports = {
  isGooglePlacesConfigured,
  searchPlacesByText,
};
