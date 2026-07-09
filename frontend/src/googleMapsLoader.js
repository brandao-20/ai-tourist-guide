import { getGoogleMapsBrowserApiKey } from './config.js';

let googleMapsPromise = null;

function createGoogleMapsError(message, reason = 'default') {
  const error = new Error(message);
  error.reason = reason;
  return error;
}

function hasGoogleMapsApi() {
  return Boolean(window.google?.maps?.Map);
}

function buildGoogleMapsUrl({ apiKey, language }) {
  const callbackName = '__ptgGoogleMapsReady';
  const params = new URLSearchParams({
    key: apiKey,
    language,
    callback: callbackName,
    loading: 'async',
  });

  return {
    callbackName,
    url: `https://maps.googleapis.com/maps/api/js?${params.toString()}`,
  };
}

export function loadGoogleMapsScript({ language = 'en' } = {}) {
  if (hasGoogleMapsApi()) {
    return Promise.resolve();
  }

  const apiKey = getGoogleMapsBrowserApiKey();
  if (!apiKey) {
    return Promise.reject(createGoogleMapsError('Google Maps browser API key is not configured.', 'missing_browser_api_key'));
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const { callbackName, url } = buildGoogleMapsUrl({ apiKey, language });
    const existingScript = document.querySelector('script[data-google-maps-loader="promise"]');

    const cleanup = () => {
      if (window[callbackName] === onReady) {
        delete window[callbackName];
      }
    };

    function onReady() {
      if (!hasGoogleMapsApi()) {
        cleanup();
        reject(createGoogleMapsError('Google Maps API loaded but the maps namespace is unavailable.', 'script_load_failed'));
        return;
      }

      cleanup();
      resolve();
    }

    window[callbackName] = onReady;

    if (existingScript) {
      if (hasGoogleMapsApi()) {
        onReady();
        return;
      }

      existingScript.addEventListener('error', () => {
        cleanup();
        reject(createGoogleMapsError('Google Maps API could not be loaded.', 'script_load_failed'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = 'promise';
    script.onerror = () => {
      cleanup();
      reject(createGoogleMapsError('Google Maps API could not be loaded.', 'script_load_failed'));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    googleMapsPromise = null;
    throw error;
  });

  return googleMapsPromise;
}
