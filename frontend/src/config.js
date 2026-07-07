export function getApiBaseUrl() {
  return window.APP_CONFIG?.API_BASE_URL || 'http://localhost:5000';
}

export function getApiUrl(path = '') {
  const baseUrl = getApiBaseUrl().replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export function getGoogleMapsBrowserApiKey() {
  const value = window.APP_CONFIG?.GOOGLE_MAPS_BROWSER_API_KEY;
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim();
  const lower = normalized.toLowerCase();
  const placeholders = [
    'your_google_maps_browser_api_key',
    'replace_with_google_maps_browser_api_key',
    'change_me_google_maps_browser_api_key',
  ];

  return normalized && !placeholders.includes(lower) ? normalized : '';
}

export function getUploadUrl(filename) {
  return getApiUrl(`/uploads/${filename}`);
}
