import { stripHtml } from './ui.js';

const COMMERCIAL_SPLITTERS = [' | ', ' – ', ' — '];
const GENERIC_PLACE_WORDS = /\b(apartments?|hotel|hostel|guest\s?house|bnb|booking|wine\s+apartments?)\b/i;

export function compactWhitespace(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function truncateText(value = '', maxLength = 84) {
  const text = compactWhitespace(value);
  if (text.length <= maxLength) {
    return text;
  }

  const slice = text.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  const safeBreak = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf(','));
  const clipped = safeBreak > Math.floor(maxLength * 0.58) ? slice.slice(0, safeBreak) : slice;
  return `${clipped.replace(/[\s,.;:]+$/g, '')}…`;
}

export function normalizePlaceName(value = '', fallback = 'Stop', maxLength = 72) {
  let text = compactWhitespace(stripHtml(value || fallback));

  COMMERCIAL_SPLITTERS.forEach((splitter) => {
    if (text.includes(splitter)) {
      const parts = text.split(splitter).map((part) => compactWhitespace(part)).filter(Boolean);
      if (parts.length > 1) {
        const [first, ...rest] = parts;
        const noisyRest = rest.some((part) => GENERIC_PLACE_WORDS.test(part));
        text = noisyRest || first.length >= 12 ? first : parts.slice(0, 2).join(' · ');
      }
    }
  });

  text = text
    .replace(/\s+\|\s+.+$/g, '')
    .replace(/\s+-\s+Google Maps$/i, '')
    .replace(/\s*\([^)]*(hotel|apartments?|booking)[^)]*\)\s*$/i, '')
    .replace(/\bSt\.?\s+/g, 'Saint ')
    .replace(/\s+/g, ' ')
    .trim();

  return truncateText(text || fallback, maxLength);
}

export function normalizeAddress(value = '', fallback = 'Address unavailable', maxLength = 110) {
  return truncateText(compactWhitespace(stripHtml(value || fallback)), maxLength);
}

export function getDisplayStopName(monument = {}, fallback = 'Stop') {
  return normalizePlaceName(monument.name || monument.placeQuery || monument.mapsSearchHint, fallback);
}

export function getDisplayStopLocation(monument = {}, fallback = 'Address unavailable') {
  return normalizeAddress(monument.address || monument.location || monument.city || monument.country, fallback);
}

export function getRouteEndpoints(monuments = [], directionsData = {}) {
  const legs = directionsData?.routes?.[0]?.legs;
  const firstLeg = Array.isArray(legs) ? legs[0] : null;
  const lastLeg = Array.isArray(legs) ? legs[legs.length - 1] : null;
  const firstMonument = monuments[0] || {};
  const lastMonument = monuments[monuments.length - 1] || {};

  return {
    origin: normalizePlaceName(firstLeg?.start_address || firstMonument.name || firstMonument.address, 'Origin unavailable', 64),
    destination: normalizePlaceName(lastLeg?.end_address || lastMonument.name || lastMonument.address, 'Destination unavailable', 64),
  };
}

export function createRouteSubtitle(monuments = [], directionsData = {}, maxLength = 118) {
  const endpoints = getRouteEndpoints(monuments, directionsData);
  return truncateText(`${endpoints.origin} → ${endpoints.destination}`, maxLength);
}

export function getValidCoordinates(monument = {}) {
  const lat = Number(monument?.coordinates?.lat);
  const lng = Number(monument?.coordinates?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

export function splitMonumentsByDays(monuments = [], days = []) {
  const safeMonuments = Array.isArray(monuments) ? monuments : [];
  const safeDays = Array.isArray(days) ? days : [];
  if (safeMonuments.length === 0 || safeDays.length === 0) {
    return [];
  }

  let cursor = 0;
  return safeDays.map((day, index) => {
    const activityCount = Array.isArray(day.activityDetails)
      ? day.activityDetails.length
      : Array.isArray(day.activities)
        ? day.activities.length
        : 0;
    const fallbackCount = Math.ceil((safeMonuments.length - cursor) / Math.max(1, safeDays.length - index));
    const count = Math.max(1, activityCount || fallbackCount);
    const stops = safeMonuments.slice(cursor, Math.min(safeMonuments.length, cursor + count));
    cursor += stops.length;
    return { day, stops, index };
  }).filter((group) => group.stops.length > 0);
}

export function createGoogleMapsDirectionsUrlFromStops(stops = [], maxWaypoints = 9) {
  const values = stops
    .map((stop) => stop?.address || stop?.name || stop?.placeQuery || stop?.mapsSearchHint)
    .map((value) => compactWhitespace(value))
    .filter(Boolean);

  if (values.length < 2) {
    return null;
  }

  const params = new URLSearchParams({
    api: '1',
    origin: values[0],
    destination: values[values.length - 1],
    travelmode: 'driving',
  });

  const waypoints = values.slice(1, -1).slice(0, maxWaypoints);
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.join('|'));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function createDailyGoogleMapsLinks(routeDetails = {}) {
  const itinerary = routeDetails.itinerary || {};
  const days = Array.isArray(itinerary.days) ? itinerary.days : [];
  const monuments = Array.isArray(itinerary.monuments) ? itinerary.monuments : [];
  return splitMonumentsByDays(monuments, days)
    .map(({ day, stops, index }) => ({
      label: `Day ${day.day || index + 1}`,
      title: day.title || day.city || 'Daily route',
      stopCount: stops.length,
      url: createGoogleMapsDirectionsUrlFromStops(stops),
    }))
    .filter((item) => item.url);
}
