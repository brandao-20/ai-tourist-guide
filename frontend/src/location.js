const CONFIGURED_DEFAULT_LOCATION = Object.freeze({
  lat: 41.5454,
  lng: -8.4265,
  label: 'Braga, Portugal',
  source: 'configured',
});

const GEOLOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  timeout: 9000,
  maximumAge: 300000,
});

const STORAGE_KEY = 'ptg:lastKnownLocation';

function canUseBrowserLocation() {
  return typeof navigator !== 'undefined' && Boolean(navigator.geolocation);
}

function normalizeLocation(value, fallbackSource = 'configured') {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    accuracy: Number.isFinite(Number(value.accuracy)) ? Number(value.accuracy) : null,
    label: typeof value.label === 'string' && value.label.trim() ? value.label.trim() : 'Current map preview',
    source: typeof value.source === 'string' && value.source.trim() ? value.source.trim() : fallbackSource,
  };
}

function getConfiguredDefaultLocation() {
  const configured = normalizeLocation(window.APP_CONFIG?.DEFAULT_MAP_LOCATION, 'configured');
  return configured || { ...CONFIGURED_DEFAULT_LOCATION };
}

function readCachedLocation() {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed.savedAt);
    const oneDay = 24 * 60 * 60 * 1000;
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > oneDay) {
      window.localStorage?.removeItem(STORAGE_KEY);
      return null;
    }

    const location = normalizeLocation(parsed.location, 'cached');
    return location ? { ...location, source: 'cached' } : null;
  } catch (error) {
    return null;
  }
}

function writeCachedLocation(location) {
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify({
      savedAt: Date.now(),
      location,
    }));
  } catch (error) {
    // Ignore storage failures. The map can still use the current response.
  }
}

function getBrowserPosition(options = GEOLOCATION_OPTIONS) {
  return new Promise((resolve, reject) => {
    if (!canUseBrowserLocation()) {
      reject(new Error('Browser geolocation is not available.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export function getFallbackLocation() {
  return getConfiguredDefaultLocation();
}

export async function getBrowserMapLocation() {
  const position = await getBrowserPosition();
  const { latitude, longitude, accuracy } = position.coords || {};

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Invalid geolocation coordinates.');
  }

  const location = {
    lat: latitude,
    lng: longitude,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    label: 'Your current location',
    source: 'browser',
  };

  writeCachedLocation(location);
  return location;
}

export async function getPreferredMapLocation({ allowCache = true } = {}) {
  try {
    return await getBrowserMapLocation();
  } catch (error) {
    if (allowCache) {
      const cachedLocation = readCachedLocation();
      if (cachedLocation) {
        return cachedLocation;
      }
    }

    return getFallbackLocation();
  }
}
