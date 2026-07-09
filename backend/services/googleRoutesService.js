const axios = require('axios');
const { appConfig } = require('../config/env');
const { logServerWarning } = require('../utils/logger');

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const DEFAULT_FIELD_MASK = [
  'routes.distanceMeters',
  'routes.duration',
  'routes.polyline.encodedPolyline',
].join(',');

const TRAVEL_MODE_MAP = new Map([
  ['car', 'DRIVE'],
  ['drive', 'DRIVE'],
  ['driving', 'DRIVE'],
  ['mixed', 'DRIVE'],
  ['walk', 'WALK'],
  ['walking', 'WALK'],
  ['bike', 'BICYCLE'],
  ['bicycle', 'BICYCLE'],
  ['bicycling', 'BICYCLE'],
  ['cycling', 'BICYCLE'],
  ['transit', 'TRANSIT'],
]);

function isGoogleRoutesConfigured() {
  return Boolean(appConfig.googleRoutes.apiKey);
}

function normalizeTravelMode(value) {
  const key = String(value || '').trim().toLowerCase();
  return TRAVEL_MODE_MAP.get(key) || 'DRIVE';
}

function toFiniteNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toWaypoint(stop) {
  const lat = toFiniteNumber(stop?.coordinates?.lat);
  const lng = toFiniteNumber(stop?.coordinates?.lng);

  if (lat === null || lng === null) {
    return null;
  }

  return {
    location: {
      latLng: {
        latitude: lat,
        longitude: lng,
      },
    },
  };
}

function parseGoogleDurationSeconds(value) {
  if (typeof value === 'string') {
    const match = value.match(/^(\d+(?:\.\d+)?)s$/);
    return match ? Math.round(Number(match[1])) : null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.round(numericValue) : null;
}

function formatDistanceText(meters) {
  if (!Number.isFinite(meters) || meters <= 0) {
    return '';
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  const kilometers = meters / 1000;
  return `${kilometers.toFixed(kilometers >= 10 ? 0 : 1)} km`;
}

function formatDurationText(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours <= 0) {
    return `${Math.max(minutes, 1)} min`;
  }

  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

function normalizeRouteLeg(leg, index) {
  const distanceMeters = toFiniteNumber(leg?.distanceMeters);
  const durationSeconds = parseGoogleDurationSeconds(leg?.duration);

  return {
    index,
    distanceMeters,
    durationSeconds,
    distance: {
      text: formatDistanceText(distanceMeters),
      value: distanceMeters || 0,
    },
    duration: {
      text: formatDurationText(durationSeconds),
      value: durationSeconds || 0,
    },
  };
}

function normalizeRouteMetadata(route, options = {}) {
  if (!route || typeof route !== 'object') {
    return null;
  }

  const distanceMeters = toFiniteNumber(route.distanceMeters);
  const durationSeconds = parseGoogleDurationSeconds(route.duration);
  const legs = Array.isArray(route.legs)
    ? route.legs.map((leg, index) => normalizeRouteLeg(leg, index)).filter(Boolean)
    : [];

  return {
    source: 'google-routes-api',
    travelMode: normalizeTravelMode(options.travelMode),
    distanceMeters,
    durationSeconds,
    distanceText: formatDistanceText(distanceMeters),
    durationText: formatDurationText(durationSeconds),
    encodedPolyline: route.polyline?.encodedPolyline || null,
    legs,
  };
}

function combineSegmentMetadata(segments = [], options = {}) {
  const validSegments = segments.filter(Boolean);
  if (validSegments.length === 0) {
    return null;
  }

  const distanceMeters = validSegments.reduce((sum, segment) => sum + (segment.distanceMeters || 0), 0);
  const durationSeconds = validSegments.reduce((sum, segment) => sum + (segment.durationSeconds || 0), 0);

  return {
    source: 'google-routes-api-segmented',
    travelMode: normalizeTravelMode(options.travelMode),
    distanceMeters,
    durationSeconds,
    distanceText: formatDistanceText(distanceMeters),
    durationText: formatDurationText(durationSeconds),
    encodedPolyline: null,
    legs: validSegments.map((segment, index) => ({
      index,
      distanceMeters: segment.distanceMeters,
      durationSeconds: segment.durationSeconds,
      distance: segment.distance,
      duration: segment.duration,
    })),
  };
}

function getGoogleRoutesErrorDetails(error) {
  const errorData = error.response?.data?.error || error.response?.data || null;
  return {
    status: error.response?.status,
    code: error.code,
    message: error.message,
    googleStatus: errorData?.status,
    googleMessage: errorData?.message,
    googleDetails: Array.isArray(errorData?.details) ? errorData.details.slice(0, 2) : undefined,
  };
}

async function requestRouteMetadata(waypoints, options = {}) {
  const [origin, ...middle] = waypoints;
  const destination = middle.pop();

  const payload = {
    origin,
    destination,
    intermediates: middle,
    travelMode: normalizeTravelMode(options.travelMode),
    routingPreference: 'TRAFFIC_UNAWARE',
    computeAlternativeRoutes: false,
    languageCode: options.languageCode || 'en',
    units: 'METRIC',
  };

  const response = await axios.post(ROUTES_ENDPOINT, payload, {
    timeout: appConfig.googleRoutes.timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': appConfig.googleRoutes.apiKey,
      'X-Goog-FieldMask': options.fieldMask || DEFAULT_FIELD_MASK,
    },
  });

  const route = response.data?.routes?.[0] || null;
  return normalizeRouteMetadata(route, options);
}

async function computeSegmentedRouteMetadata(waypoints, options = {}) {
  const segments = [];

  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const segment = await requestRouteMetadata([waypoints[index], waypoints[index + 1]], options);
    if (segment) {
      segments.push(segment);
    }
  }

  return combineSegmentMetadata(segments, options);
}

async function computeRouteMetadata(stops = [], options = {}) {
  if (!isGoogleRoutesConfigured()) {
    return { configured: false, metadata: null };
  }

  const waypoints = stops.map(toWaypoint).filter(Boolean);
  if (waypoints.length < 2) {
    return { configured: true, metadata: null };
  }

  try {
    const metadata = await requestRouteMetadata(waypoints, options);
    return {
      configured: true,
      metadata,
    };
  } catch (error) {
    logServerWarning('Google Routes full-route metadata unavailable; trying segmented route metadata.', getGoogleRoutesErrorDetails(error));

    try {
      const segmentedMetadata = await computeSegmentedRouteMetadata(waypoints, options);
      return {
        configured: true,
        metadata: segmentedMetadata,
      };
    } catch (segmentError) {
      logServerWarning('Google Routes segmented metadata unavailable; returning null metadata.', getGoogleRoutesErrorDetails(segmentError));
      return { configured: true, metadata: null };
    }
  }
}

module.exports = {
  computeRouteMetadata,
  isGoogleRoutesConfigured,
  normalizeTravelMode,
};
