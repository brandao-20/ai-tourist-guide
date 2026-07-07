(function loadGoogleMaps() {
  const config = window.APP_CONFIG || {};
  const apiKey = config.GOOGLE_MAPS_BROWSER_API_KEY;
  const currentScript = document.currentScript;
  const callback = currentScript?.dataset?.callback || 'initMap';
  const language = currentScript?.dataset?.language || 'en';
  const PLACEHOLDER_VALUES = new Set([
    'your_google_maps_browser_api_key',
    'replace_with_google_maps_browser_api_key',
    'change_me_google_maps_browser_api_key',
  ]);

  function isConfiguredKey(value) {
    if (typeof value !== 'string') {
      return false;
    }

    const normalized = value.trim().toLowerCase();
    return Boolean(normalized) && !PLACEHOLDER_VALUES.has(normalized);
  }

  function notifyUnavailable(reason) {
    const fallbackCallback = `${callback}Unavailable`;

    if (typeof window[fallbackCallback] === 'function') {
      window[fallbackCallback](reason);
    }

    document.dispatchEvent(new CustomEvent('google-maps-unavailable', {
      detail: { callback, reason },
    }));
  }

  if (!isConfiguredKey(apiKey)) {
    notifyUnavailable('missing_browser_api_key');
    return;
  }

  if (window.google?.maps) {
    if (typeof window[callback] === 'function') {
      window[callback]();
    }
    return;
  }

  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey.trim())}&language=${encodeURIComponent(language)}&callback=${encodeURIComponent(callback)}`;
  script.async = true;
  script.defer = true;
  script.onerror = () => notifyUnavailable('script_load_failed');
  document.head.appendChild(script);
})();
