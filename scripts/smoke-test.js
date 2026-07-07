#!/usr/bin/env node

const crypto = require('crypto');

const API_BASE_URL = process.env.SMOKE_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:5000';
const FRONTEND_BASE_URL = process.env.SMOKE_FRONTEND_BASE_URL || process.env.FRONTEND_BASE_URL || 'http://localhost:8080';
const TEST_PASSWORD = 'Password123!';

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  addFromResponse(response) {
    const setCookie = response.headers.get('set-cookie');
    if (!setCookie) {
      return;
    }

    setCookie.split(/,(?=\s*[^;=]+=[^;]+)/).forEach((cookieHeader) => {
      const [cookiePair] = cookieHeader.trim().split(';');
      const separatorIndex = cookiePair.indexOf('=');
      if (separatorIndex === -1) {
        return;
      }

      const name = cookiePair.slice(0, separatorIndex);
      const value = cookiePair.slice(separatorIndex + 1);
      this.cookies.set(name, value);
    });
  }

  header() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
}

function buildUrl(baseUrl, path) {
  return new URL(path, baseUrl).toString();
}

async function request(path, options = {}, jar = null) {
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (jar?.header()) {
    headers.Cookie = jar.header();
  }

  const response = await fetch(buildUrl(API_BASE_URL, path), {
    ...options,
    headers,
    redirect: options.redirect || 'manual',
  });

  jar?.addFromResponse(response);

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' ? JSON.stringify(payload) : payload;
    throw new Error(`${options.method || 'GET'} ${path} failed with ${response.status}: ${message}`);
  }

  return { response, payload };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasConfiguredBrowserMapKeyFromConfig(configJs) {
  const match = configJs.match(/[\"']?GOOGLE_MAPS_BROWSER_API_KEY[\"']?\s*:\s*['\"]([^'\"]*)['\"]/);
  const value = match?.[1]?.trim().toLowerCase() || '';

  return Boolean(value) && ![
    'your_google_maps_browser_api_key',
    'replace_with_google_maps_browser_api_key',
    'change_me_google_maps_browser_api_key',
  ].includes(value);
}

async function checkFrontendHealth() {
  const response = await fetch(buildUrl(FRONTEND_BASE_URL, '/health'));
  assert(response.ok, `Frontend health failed with status ${response.status}.`);
}

async function checkFrontendMapsConfig() {
  const response = await fetch(buildUrl(FRONTEND_BASE_URL, '/config.js'));
  assert(response.ok, `Frontend config.js failed with status ${response.status}.`);

  const configJs = await response.text();
  assert(
    hasConfiguredBrowserMapKeyFromConfig(configJs),
    'Google Maps browser key is missing in frontend/public/config.js.'
  );
}

async function runSmokeTest() {
  const runId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const email = `smoke-${runId}@example.com`;
  const name = `Smoke Test ${runId}`;
  const jar = new CookieJar();

  console.log(`Smoke API: ${API_BASE_URL}`);
  console.log(`Smoke frontend: ${FRONTEND_BASE_URL}`);

  await checkFrontendHealth();
  console.log('✓ frontend health');

  await checkFrontendMapsConfig();
  console.log('✓ Google Maps browser config');

  const { payload: health } = await request('/api/health');
  assert(health.status === 'ok', 'API health did not return status=ok.');
  console.log('✓ API health');

  const { payload: capabilities } = await request('/api/capabilities');
  assert(capabilities.capabilities?.maps?.required === true, 'Backend must report Google Maps as required.');
  assert(capabilities.capabilities?.maps?.serverGeocoding === true, 'Google Maps server geocoding key is missing in .env.');
  console.log('✓ Google Maps backend config');

  const { payload: status } = await request('/api/status');
  assert(status.status === 'ready', 'API status is not ready. Did you run npm run db:sync and configure Google Maps server key?');
  console.log('✓ API status/readiness');

  const { payload: registered } = await request('/api/users/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password: TEST_PASSWORD }),
  }, jar);
  assert(registered.user?.email === email, 'Registration response did not include the expected user.');
  console.log('✓ registration');

  const { payload: login } = await request('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  }, jar);
  assert(login.user?.email === email, 'Login response did not include the expected user.');
  console.log('✓ login/session');

  const { payload: currentUser } = await request('/api/user', {}, jar);
  assert(currentUser.email === email, 'Session user endpoint returned the wrong user.');
  console.log('✓ current user');

  const updatedName = `${name} Updated`;
  const profilePreferences = {
    travelPace: 'relaxed',
    budget: 'flexible',
    transportMode: 'driving',
    walkingTolerance: 'medium',
    favoriteInterests: ['Historic Neighborhoods', 'Viewpoints', 'Local Experiences'],
    notes: 'Prefer scenic routes with local food stops.',
  };
  const { payload: updatedProfile } = await request('/api/user/profile', {
    method: 'PUT',
    body: JSON.stringify({ name: updatedName, travelPreferences: profilePreferences }),
  }, jar);
  assert(updatedProfile.user?.name === updatedName, 'Profile update did not return the updated name.');
  assert(updatedProfile.user?.travelPreferences?.travelPace === 'relaxed', 'Profile preferences were not saved.');
  console.log('✓ profile update/preferences');

  const searchPayload = {
    generalQuery: 'historic viewpoints, local food and walkable areas',
    selectedCountries: ['PT'],
    selectedCities: ['Lisbon'],
    selectedAttractions: ['Museums'],
    selectedDays: ['1'],
  };
  const { payload: searchResult } = await request('/api/search', {
    method: 'POST',
    body: JSON.stringify(searchPayload),
  }, jar);
  assert(Array.isArray(searchResult.itinerary), 'Search did not return an itinerary array.');
  assert(Array.isArray(searchResult.monuments), 'Search did not return a monuments array.');
  console.log('✓ search');

  const favoritePayload = {
    name: `Smoke Lisbon ${runId}`,
    itinerary: {
      days: searchResult.itinerary,
      monuments: searchResult.monuments,
    },
    map_data: {
      provider: 'google-maps-smoke-fixture',
      routes: [{
        summary: 'Smoke route',
        legs: [{
          start_address: 'Lisbon',
          end_address: 'Belém',
          distance: { text: '7 km' },
          duration: { text: '20 mins' },
          steps: [{ instructions: 'Smoke-test Google Maps route segment fixture.' }],
        }],
      }],
    },
  };

  const { payload: favoriteCreated } = await request('/api/favorites', {
    method: 'POST',
    body: JSON.stringify(favoritePayload),
  }, jar);
  const favoriteId = favoriteCreated.favoriteId;
  assert(Number.isInteger(Number(favoriteId)), 'Favorite creation did not return a valid favoriteId.');
  assert(favoriteCreated.action === 'created', 'First favorite save should create a new record.');
  console.log('✓ favorite create');

  const { payload: favoriteUpdated } = await request('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ ...favoritePayload, name: `Smoke Lisbon updated ${runId}` }),
  }, jar);
  assert(favoriteUpdated.action === 'updated', 'Duplicate favorite save should update the existing record.');
  assert(Number(favoriteUpdated.favoriteId) === Number(favoriteId), 'Duplicate favorite save returned a different favoriteId.');
  console.log('✓ favorite duplicate update');

  const { payload: favorites } = await request('/api/favorites', {}, jar);
  assert(Array.isArray(favorites), 'Favorites list did not return an array.');
  const matchingFavorites = favorites.filter((favorite) => Number(favorite.id) === Number(favoriteId));
  assert(matchingFavorites.length === 1, 'Favorite duplicate handling did not keep a single saved route.');
  assert(matchingFavorites[0].name.includes('updated'), 'Favorite update did not persist the latest route name.');
  console.log('✓ favorite list');

  const { payload: favoriteDetails } = await request(`/api/favorites/${favoriteId}`, {}, jar);
  assert(Number(favoriteDetails.id) === Number(favoriteId), 'Favorite details returned the wrong route.');
  console.log('✓ favorite details');

  const renamedFavoriteName = `Smoke Lisbon renamed ${runId}`;
  const { payload: renamedFavorite } = await request(`/api/favorites/${favoriteId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: renamedFavoriteName }),
  }, jar);
  assert(renamedFavorite.favorite?.name === renamedFavoriteName, 'Favorite rename did not persist the new name.');
  console.log('✓ favorite rename');

  await request(`/api/favorites/${favoriteId}`, { method: 'DELETE' }, jar);
  console.log('✓ favorite delete');

  const { payload: recentSaved } = await request('/api/recent_search', {
    method: 'POST',
    body: JSON.stringify({
      query_params: searchPayload,
      itinerary: searchResult.itinerary,
      monuments: searchResult.monuments,
      directions: favoritePayload.map_data,
    }),
  }, jar);
  assert(recentSaved.message, 'Recent search save did not return a success message.');

  const { payload: recentSearch } = await request('/api/recent_search', {}, jar);
  assert(recentSearch.query_params?.generalQuery === searchPayload.generalQuery, 'Recent search did not return the saved query.');
  console.log('✓ recent search');

  console.log('Smoke tests passed.');
}

runSmokeTest().catch((error) => {
  console.error(`Smoke tests failed: ${error.message}`);
  process.exitCode = 1;
});
