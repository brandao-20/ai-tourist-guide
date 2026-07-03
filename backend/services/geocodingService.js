const axios = require('axios');
const { appConfig } = require('../config/env');
const { logServerWarning } = require('../utils/logger');

const MAX_ADDRESS_LENGTH = 240;

function normalizeAddress(address) {
  return typeof address === 'string'
    ? address.trim().replace(/\s+/g, ' ').slice(0, MAX_ADDRESS_LENGTH)
    : '';
}

function extractCoordinates(responseData) {
  const firstResult = responseData?.results?.[0];
  const location = firstResult?.geometry?.location;

  if (!Number.isFinite(Number(location?.lat)) || !Number.isFinite(Number(location?.lng))) {
    return null;
  }

  return {
    lat: Number(location.lat),
    lng: Number(location.lng),
  };
}

function logGeocodingFailure(reason, details) {
  logServerWarning(`Geocoding skipped: ${reason}`, details);
}

async function geocodeAddress(address) {
  const normalizedAddress = normalizeAddress(address);
  const apiKey = appConfig.googleMaps.serverApiKey;

  if (!normalizedAddress || !apiKey) {
    return null;
  }

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: normalizedAddress,
        key: apiKey,
      },
      timeout: appConfig.googleMaps.geocodingTimeoutMs,
    });

    const status = response.data?.status;
    if (status !== 'OK') {
      logGeocodingFailure('Google Geocoding returned a non-OK status.', { status });
      return null;
    }

    const coordinates = extractCoordinates(response.data);
    if (!coordinates) {
      logGeocodingFailure('Google Geocoding returned no usable coordinates.');
      return null;
    }

    return coordinates;
  } catch (error) {
    const status = error.response?.status;
    const code = error.code;
    logGeocodingFailure('request failed.', { status, code, message: error.message });
    return null;
  }
}

module.exports = {
  geocodeAddress,
};
