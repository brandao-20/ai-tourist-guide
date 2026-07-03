export function getApiBaseUrl() {
  return window.APP_CONFIG?.API_BASE_URL || 'http://localhost:5000';
}

export function getApiUrl(path = '') {
  const baseUrl = getApiBaseUrl().replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export function getGoogleMapsBrowserApiKey() {
  return window.APP_CONFIG?.GOOGLE_MAPS_BROWSER_API_KEY || '';
}

export function getUploadUrl(filename) {
  return getApiUrl(`/uploads/${filename}`);
}
