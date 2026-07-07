const axios = require('axios');
const { appConfig } = require('../config/env');

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

function isGoogleRoutesConfigured() {
  return Boolean(appConfig.googleRoutes.apiKey);
}

function toWaypoint(stop) {
  if (!stop?.coordinates || typeof stop.coordinates.lat !== 'number' || typeof stop.coordinates.lng !== 'number') {
    return null;
  }

  return {
    location: {
      latLng: {
        latitude: stop.coordinates.lat,
        longitude: stop.coordinates.lng,
      },
    },
  };
}

async function computeRouteMetadata(stops = [], options = {}) {
  if (!isGoogleRoutesConfigured()) {
    return { configured: false, metadata: null };
  }

  const waypoints = stops.map(toWaypoint).filter(Boolean);
  if (waypoints.length < 2) {
    return { configured: true, metadata: null };
  }

  const [origin, ...middle] = waypoints;
  const destination = middle.pop();

  const payload = {
    origin,
    destination,
    intermediates: middle,
    travelMode: options.travelMode || 'DRIVE',
    routingPreference: 'TRAFFIC_UNAWARE',
    computeAlternativeRoutes: false,
    languageCode: 'en',
    units: 'METRIC',
  };

  const response = await axios.post(ROUTES_ENDPOINT, payload, {
    timeout: appConfig.googleRoutes.timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': appConfig.googleRoutes.apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration',
    },
  });

  const route = response.data?.routes?.[0] || null;
  if (!route) {
    return { configured: true, metadata: null };
  }

  return {
    configured: true,
    metadata: {
      distanceMeters: route.distanceMeters || null,
      duration: route.duration || null,
      encodedPolyline: route.polyline?.encodedPolyline || null,
      legs: Array.isArray(route.legs) ? route.legs : [],
      source: 'google-routes-api',
    },
  };
}

module.exports = {
  computeRouteMetadata,
  isGoogleRoutesConfigured,
};
