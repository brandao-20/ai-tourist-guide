import { getApiUrl } from './config.js';

function normalizeApiPath(path = '') {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (
    normalizedPath === '/api' ||
    normalizedPath.startsWith('/api/') ||
    normalizedPath.startsWith('/auth/') ||
    normalizedPath.startsWith('/uploads/')
  ) {
    return normalizedPath;
  }

  return `/api${normalizedPath}`;
}

function appendQueryParams(path, params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== '') {
          query.append(key, item);
        }
      });
      return;
    }

    query.append(key, value);
  });

  const queryString = query.toString();
  if (!queryString) {
    return path;
  }

  return `${path}${path.includes('?') ? '&' : '?'}${queryString}`;
}

function isFormDataBody(body) {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

export class ApiRequestError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', data = null } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function parseResponseBody(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    const text = await response.text();
    return text || null;
  } catch (error) {
    return null;
  }
}

function createNetworkError(error) {
  return new ApiRequestError(
    'The API is unavailable. Check whether the backend is running and API_BASE_URL is correct.',
    { status: 0, code: 'NETWORK_ERROR', data: { originalMessage: error?.message || 'Network request failed.' } }
  );
}

export async function apiFetch(path, options = {}) {
  const { body, headers = {}, credentials = 'include', params, ...rest } = options;
  const requestHeaders = { ...headers };
  let requestBody = body;

  if (body !== undefined && !isFormDataBody(body) && typeof body !== 'string') {
    requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
    requestBody = JSON.stringify(body);
  }

  const requestPath = appendQueryParams(normalizeApiPath(path), params);
  let response;

  try {
    response = await fetch(getApiUrl(requestPath), {
      credentials,
      ...rest,
      headers: requestHeaders,
      body: requestBody,
    });
  } catch (error) {
    throw createNetworkError(error);
  }

  const data = await parseResponseBody(response);
  if (!response.ok) {
    const message = data?.error || data?.message || `Request failed with status ${response.status}.`;
    throw new ApiRequestError(message, {
      status: response.status,
      code: data?.code || 'REQUEST_FAILED',
      data,
    });
  }

  return data;
}

export function apiGet(path, options = {}) {
  return apiFetch(path, { ...options, method: 'GET' });
}

export function apiPost(path, body, options = {}) {
  return apiFetch(path, { ...options, method: 'POST', body });
}

export function apiPut(path, body, options = {}) {
  return apiFetch(path, { ...options, method: 'PUT', body });
}

export function apiDelete(path, options = {}) {
  return apiFetch(path, { ...options, method: 'DELETE' });
}

const api = {
  get: async (path, options = {}) => ({ data: await apiGet(path, options) }),
  post: async (path, body, options = {}) => ({ data: await apiPost(path, body, options) }),
  put: async (path, body, options = {}) => ({ data: await apiPut(path, body, options) }),
  delete: async (path, options = {}) => ({ data: await apiDelete(path, options) }),
};

export default api;
