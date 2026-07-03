(function loadGoogleMaps() {
  const config = window.APP_CONFIG || {};
  const apiKey = config.GOOGLE_MAPS_BROWSER_API_KEY;
  const currentScript = document.currentScript;
  const callback = currentScript?.dataset?.callback || 'initMap';
  const language = currentScript?.dataset?.language || 'en';

  if (!apiKey) {
    console.warn('Google Maps browser API key is not configured. Set GOOGLE_MAPS_BROWSER_API_KEY in frontend/public/config.js.');
    return;
  }

  if (window.google?.maps) {
    if (typeof window[callback] === 'function') {
      window[callback]();
    }
    return;
  }

  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&language=${encodeURIComponent(language)}&callback=${encodeURIComponent(callback)}`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
})();
