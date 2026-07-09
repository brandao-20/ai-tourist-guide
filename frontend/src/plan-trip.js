import { apiDelete, apiGet, apiPost } from './api.js';
import { getErrorMessage, isValidNumericId, setButtonBusy, showFavoriteNameModal } from './ui.js';
import { showLoadingIndicator, hideLoadingIndicator } from './plan-trip/loader.js';
import { createMapItineraryController } from './plan-trip/mapItinerary.js';
import { createManualMonumentController } from './plan-trip/manualMonumentModal.js';
import { configureNotifications, createNotifier } from './plan-trip/notifications.js';
import { createSearchFormController } from './plan-trip/searchForm.js';
import { getBrowserMapLocation, getFallbackLocation, getPreferredMapLocation } from './location.js';
import { createMapMarker } from './mapMarker.js';
import { loadGoogleMapsScript } from './googleMapsLoader.js';

import { requireAuthenticatedSession, setupLogoutButton } from './session.js';
setupLogoutButton();
const DEFAULT_LOCATION = getFallbackLocation();

const DEFAULT_MAP_OPTIONS = {
  zoom: 6,
  center: { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng },
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
};

const MAP_UNAVAILABLE_MESSAGES = {
  missing_browser_api_key: 'The interactive map is temporarily unavailable. Your itinerary is still available as a list.',
  script_load_failed: 'The interactive map could not be loaded. Your itinerary is still available as a list.',
  default: 'The interactive map is temporarily unavailable. Your itinerary is still available as a list.',
};

let plannerSessionPromise = null;

function ensurePlannerSession() {
  if (!plannerSessionPromise) {
    plannerSessionPromise = requireAuthenticatedSession({ next: '/plan-trip' });
  }

  return plannerSessionPromise;
}

const state = {
  appInitialized: false,
  mapEnabled: false,
  lastItinerary: null,
  currentFavoriteId: null,
  lastDirectionsResult: null,
  routeMetadata: null,
  markers: [],
  currentMonuments: [],
  searchExecuted: false,
  previewLocation: DEFAULT_LOCATION,
  userLocationMarker: null,
  routePolyline: null,
  providerInfo: null,
};

function getMapElement() {
  return document.getElementById('map');
}

function setMapStatus(label, type = 'info') {
  const statusPill = document.getElementById('map-status-pill');
  if (!statusPill) {
    return;
  }

  statusPill.textContent = label;
  statusPill.dataset.state = type;
}

function setLocationStatus(message) {
  const status = document.getElementById('location-status');
  if (status) {
    status.textContent = message;
  }
}

function getLocationStatusMessage(location) {
  if (location?.source === 'browser') {
    return 'Showing your current location. Generate an itinerary to add stops to the map.';
  }
  if (location?.source === 'cached') {
    return 'Showing your last shared location. Generate an itinerary to add stops to the map.';
  }
  return 'Allow browser location or use the button above to centre the map on your current position.';
}

function applyMapLocation(location) {
  if (!window.google?.maps || !window.myMap || !location) {
    return;
  }

  state.previewLocation = location;
  window.myMap.setCenter({ lat: location.lat, lng: location.lng });
  window.myMap.setZoom(location.source === 'browser' || location.source === 'cached' ? 13 : 11);
  setUserLocationMarker(location);
  setMapStatus(location.source === 'browser' ? 'Current location' : location.label || 'Map preview', 'info');
  setLocationStatus(getLocationStatusMessage(location));
}


function setUserLocationMarker(location) {
  if (!window.google?.maps || !window.myMap || !location) {
    return;
  }

  if (state.userLocationMarker) {
    state.userLocationMarker.setMap(null);
  }

  state.userLocationMarker = createMapMarker({
    position: { lat: location.lat, lng: location.lng },
    map: window.myMap,
    title: location.label || 'Map preview location',
    variant: 'dot',
  });
}

async function centerMapOnPreferredLocation() {
  if (!window.google?.maps || !window.myMap) {
    return;
  }

  setLocationStatus('Requesting browser location...');
  const location = await getPreferredMapLocation({ allowCache: false, requestBrowser: false });
  applyMapLocation(location);
}

async function forceCurrentLocation() {
  if (!window.google?.maps || !window.myMap) {
    setLocationStatus('The interactive map is temporarily unavailable.');
    return;
  }

  setLocationStatus('Requesting browser location...');
  try {
    const location = await getBrowserMapLocation();
    applyMapLocation(location);
  } catch (error) {
    const location = getFallbackLocation();
    applyMapLocation(location);
    setLocationStatus('Browser location is unavailable. Check site permissions and try again.');
  }
}

function setPlannerControlsDisabled(disabled) {
  const controlSelectors = [
    '#overall-search',
    '#search-button',
    '#save-button',
    '#favorite-button',
    '#unfavorite-button',
    '#add-button',
    '.dropdown-toggle',
    '.dropdown-search',
  ];

  document.querySelectorAll(controlSelectors.join(',')).forEach((element) => {
    element.disabled = disabled;
    element.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  });
}

function setConfigurationRequiredState(reason = 'default') {
  const mapElement = getMapElement();
  if (!mapElement) {
    return;
  }

  const message = MAP_UNAVAILABLE_MESSAGES[reason] || MAP_UNAVAILABLE_MESSAGES.default;
  mapElement.classList.add('map-canvas--fallback');
  mapElement.innerHTML = `
    <div class="state-card state-card--required">
      <span class="state-card__badge">List view available</span>
      <h3>Map temporarily unavailable</h3>
      <p>${message}</p>
      <p>You can still generate, review and save your itinerary from the stop list.</p>
    </div>
  `;
  setMapStatus('List view available', 'warning');
  setPlannerControlsDisabled(false);
}

function clearMapFallbackState() {
  const mapElement = getMapElement();
  if (!mapElement) {
    return;
  }

  mapElement.classList.remove('map-canvas--fallback');
  mapElement.innerHTML = '';
  setMapStatus('Interactive map', 'info');
  setPlannerControlsDisabled(false);
}

async function initializeInteractiveMap({ skipSessionCheck = false } = {}) {
  const user = skipSessionCheck ? true : await ensurePlannerSession();
  if (!user) {
    return;
  }

  if (!window.google?.maps) {
    initializeMapUnavailable('default', { skipSessionCheck: true });
    return;
  }

  clearMapFallbackState();
  window.myMap = new google.maps.Map(getMapElement(), DEFAULT_MAP_OPTIONS);
  initializeApp({ mapEnabled: true });
  centerMapOnPreferredLocation();
};

async function initializeMapUnavailable(reason = 'default', { skipSessionCheck = false } = {}) {
  const user = skipSessionCheck ? true : await ensurePlannerSession();
  if (!user) {
    return;
  }

  configureNotifications();
  const notify = createNotifier();
  window.myMap = null;
  state.mapEnabled = false;
  setConfigurationRequiredState(reason);
  initializeApp({ mapEnabled: false });
  notify.warning('The interactive map is temporarily unavailable. Your itinerary is still available as a list.');
}

window.initMap = initializeInteractiveMap;
window.initMapUnavailable = initializeMapUnavailable;

async function bootPlanner() {
  const user = await ensurePlannerSession();
  if (!user) {
    return;
  }

  try {
    await loadGoogleMapsScript({ language: 'en', libraries: ['places'] });
    await initializeInteractiveMap({ skipSessionCheck: true });
  } catch (error) {
    await initializeMapUnavailable(error.reason || 'default', { skipSessionCheck: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootPlanner, { once: true });
} else {
  bootPlanner();
}

function readRecentSearchFromStorage() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('recent') !== 'true') {
    return null;
  }

  const recentSearchData = localStorage.getItem('recentSearch');
  if (!recentSearchData) {
    return null;
  }

  try {
    return JSON.parse(recentSearchData);
  } catch (error) {
    localStorage.removeItem('recentSearch');
    return null;
  }
}

function setFavoriteButtonsFavorited(isFavorited) {
  const favoriteButton = document.getElementById('favorite-button');
  const unfavoriteButton = document.getElementById('unfavorite-button');

  if (favoriteButton) {
    favoriteButton.hidden = isFavorited;
  }
  if (unfavoriteButton) {
    unfavoriteButton.hidden = !isFavorited;
  }
}

function clearFavoriteState() {
  state.currentFavoriteId = null;
  setFavoriteButtonsFavorited(false);
  syncRouteActionButtons();
}

function setPlannerResultsVisible(visible) {
  const results = document.getElementById('planner-results');
  if (results) {
    results.hidden = !visible;
  }
}

function syncRouteActionButtons() {
  const hasStops = Array.isArray(state.currentMonuments) && state.currentMonuments.length > 0;
  const canBuildRoute = state.currentMonuments.length >= 2;
  const hasRoute = Boolean(state.lastDirectionsResult?.routes || state.lastDirectionsResult?.fallback || state.routeMetadata);
  const centerButton = document.getElementById('center-route-button');
  const buildRouteButton = document.getElementById('save-button');
  const favoriteButton = document.getElementById('favorite-button');
  const unfavoriteButton = document.getElementById('unfavorite-button');
  const addButton = document.getElementById('add-button');

  if (centerButton) {
    centerButton.hidden = !state.mapEnabled;
  }
  if (buildRouteButton) {
    buildRouteButton.hidden = !canBuildRoute;
    buildRouteButton.disabled = !canBuildRoute;
  }
  if (favoriteButton) {
    if (!favoriteButton.textContent.trim()) {
      favoriteButton.textContent = 'Save route';
    }
    favoriteButton.hidden = Boolean(state.currentFavoriteId) || !hasStops;
    favoriteButton.disabled = !hasStops;
  }
  if (unfavoriteButton) {
    unfavoriteButton.hidden = !state.currentFavoriteId;
  }
  if (addButton) {
    addButton.hidden = !state.searchExecuted;
  }
}

function setupSearchButton({ searchForm, itineraryController, notify }) {
  const searchButton = document.getElementById('search-button');
  if (!searchButton) {
    notify.error('Search button not found.');
    return;
  }

  const panelSearchButton = document.getElementById('search-button-panel');
  if (panelSearchButton) {
    panelSearchButton.addEventListener('click', () => searchButton.click());
  }

  searchButton.addEventListener('click', async () => {
    const payload = searchForm.getPayload();
    const validationErrors = searchForm.validatePayload(payload);

    if (validationErrors.length > 0) {
      validationErrors.forEach((message) => notify.error(message));
      return;
    }

    const restoreButton = setButtonBusy(searchButton, 'Generating...');
    showLoadingIndicator();
    try {
      const result = await apiPost('/search', payload);
      if (result?.error) {
        notify.error('An error occurred while processing your search.');
        return;
      }

      state.lastItinerary = result.itinerary || null;
      state.providerInfo = result.providerInfo || null;
      itineraryController.displaySearchResult({
        itinerary: result.itinerary || [],
        monuments: result.monuments || [],
        directions: result.routes || null,
        routeMetadata: result.routeMetadata || null,
      });
      setPlannerResultsVisible(true);

      const recentDirections = result.routes || {
        fallback: true,
        source: result.routeMetadata ? 'google-routes-api-polyline' : 'generated-itinerary',
        routes: [],
        routeMetadata: result.routeMetadata || null,
      };
      await itineraryController.saveRecentSearch(recentDirections);

      if (result.providerInfo?.usedFallback) {
        notify.warning('OpenAI was unavailable, so a local fallback itinerary was generated. Review the route carefully.');
      } else if (result.providerInfo?.aiProvider === 'openai') {
        notify.success('Itinerary generated with OpenAI. Review the stops and save the route when ready.');
      }

      if (result.routeMetadata) {
        notify.success('Route metadata calculated. Review the stops and map route before saving.');
      } else if (!result.routes) {
        notify.warning('Route metadata is unavailable. Review the stop order before saving.');
      }

      state.searchExecuted = true;
      syncRouteActionButtons();
      clearFavoriteState();
    } catch (error) {
      notify.error('An error occurred while sending your search.');
    } finally {
      hideLoadingIndicator();
      restoreButton();
    }
  });
}

function setupCenterRouteButton({ itineraryController }) {
  const centerButton = document.getElementById('center-route-button');
  if (!centerButton) {
    return;
  }
  centerButton.addEventListener('click', () => {
    itineraryController.centerRoute();
  });
}

function setupSaveButton({ itineraryController }) {
  const saveButton = document.getElementById('save-button');
  if (!saveButton) {
    return;
  }

  saveButton.addEventListener('click', async () => {
    const restoreButton = setButtonBusy(saveButton, 'Building route...');
    try {
      await itineraryController.saveMonuments();
    } finally {
      restoreButton();
    }
  });
}

function extractCityFromAddress(address = '') {
  const parts = String(address)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }

  return parts[0] || '';
}

function getMonumentCity(monument) {
  return monument?.city || extractCityFromAddress(monument?.address || '');
}

function getUniqueRouteCities(monuments = []) {
  const seen = new Set();
  const cities = [];

  monuments.forEach((monument) => {
    const city = getMonumentCity(monument);
    const key = city.toLowerCase();
    if (city && !seen.has(key)) {
      seen.add(key);
      cities.push(city);
    }
  });

  return cities;
}

function getTripDayCount() {
  if (Array.isArray(state.lastItinerary)) {
    return state.lastItinerary.length;
  }

  return 0;
}

function getSuggestedFavoriteName() {
  const cities = getUniqueRouteCities(state.currentMonuments);
  const dayCount = getTripDayCount();
  const suffix = dayCount > 1 ? `${dayCount}-day route` : 'route';

  if (cities.length >= 2) {
    return `${cities.slice(0, 2).join(' → ')} ${suffix}`;
  }

  if (cities.length === 1) {
    return `${cities[0]} ${suffix}`;
  }

  const firstStop = state.currentMonuments[0]?.name;
  const lastStop = state.currentMonuments[state.currentMonuments.length - 1]?.name;
  if (firstStop && lastStop && firstStop !== lastStop) {
    return `${firstStop} → ${lastStop}`;
  }

  return 'Saved itinerary';
}

function buildFallbackMapData() {
  return {
    fallback: true,
    source: 'itinerary-list',
    routes: [],
  };
}

function buildMapDataPayload() {
  const mapData = state.lastDirectionsResult || buildFallbackMapData();
  return {
    ...mapData,
    routeMetadata: state.routeMetadata || mapData.routeMetadata || null,
  };
}

function buildFavoritePayload(favoriteName) {
  return {
    name: favoriteName,
    itinerary: {
      name: favoriteName,
      days: state.lastItinerary,
      monuments: state.currentMonuments,
      summary: {
        cities: getUniqueRouteCities(state.currentMonuments),
        days: getTripDayCount(),
        stops: state.currentMonuments.length,
        providerInfo: state.providerInfo || null,
      },
    },
    map_data: buildMapDataPayload(),
  };
}

function getFavoriteSavedMessage(action) {
  return action === 'updated'
    ? 'This route already existed. The saved route was updated instead of duplicated.'
    : 'Route saved successfully.';
}

function setupFavoriteButtons({ notify }) {
  const favoriteButton = document.getElementById('favorite-button');
  const unfavoriteButton = document.getElementById('unfavorite-button');

  if (favoriteButton) {
    favoriteButton.addEventListener('click', () => {
      if (!state.lastItinerary || state.currentMonuments.length === 0) {
        notify.error('Generate an itinerary before saving this route.');
        return;
      }

      showFavoriteNameModal(async (favoriteName) => {
        const restoreButton = setButtonBusy(favoriteButton, 'Saving...');
        try {
          const data = await apiPost('/favorites', buildFavoritePayload(favoriteName));
          state.currentFavoriteId = data.favoriteId;
          notify.success(getFavoriteSavedMessage(data.action));
          setFavoriteButtonsFavorited(true);
          syncRouteActionButtons();
        } catch (error) {
          notify.error(getErrorMessage(error, 'We could not save this route. Please try again.'));
        } finally {
          restoreButton();
        }
      }, {
        defaultName: getSuggestedFavoriteName(),
        description: 'Routes with the same stops are updated automatically, so your dashboard stays clean.',
      });
    });
  }

  if (unfavoriteButton) {
    unfavoriteButton.addEventListener('click', async () => {
      if (!state.currentFavoriteId || !isValidNumericId(state.currentFavoriteId)) {
        notify.warning('This route is not currently saved.');
        return;
      }

      const restoreButton = setButtonBusy(unfavoriteButton, 'Removing...');
      try {
        await apiDelete(`/favorites/${state.currentFavoriteId}`);
        clearFavoriteState();
        notify.success('Route removed from saved routes.');
      } catch (error) {
        notify.error('We could not remove this route. Please try again.');
      } finally {
        restoreButton();
      }
    });
  }
}

function setupAddMonumentButton({ manualMonumentController, notify }) {
  const addButton = document.getElementById('add-button');
  if (!addButton) {
    return;
  }

  addButton.addEventListener('click', () => {
    if (!state.searchExecuted) {
      notify.error('Please perform a search before adding a stop.');
      return;
    }

    manualMonumentController.open();
  });
}


function setupPlannerPresets({ searchForm, notify }) {
  document.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      searchForm.applyPreset(button.dataset.preset);
      notify.success('Preset applied. Review the filters before generating the itinerary.');
    });
  });
}


function restoreRecentSearch({ searchForm, itineraryController }) {
  const recentSearch = readRecentSearchFromStorage();
  if (!recentSearch) {
    return;
  }

  searchForm.restoreQuery(recentSearch);

  if (Array.isArray(recentSearch.monuments)) {
    state.lastItinerary = recentSearch.itinerary || null;
    state.searchExecuted = true;
    itineraryController.displaySearchResult({
      itinerary: recentSearch.itinerary || [],
      monuments: recentSearch.monuments,
      directions: recentSearch.directions || null,
      routeMetadata: recentSearch.routeMetadata || recentSearch.directions?.routeMetadata || null,
      showSuccess: false,
    });
  }
}

function initializeApp({ mapEnabled }) {
  if (state.appInitialized) {
    return;
  }

  state.appInitialized = true;
  state.mapEnabled = mapEnabled;
  configureNotifications();
  const notify = createNotifier();

  if (!mapEnabled || !window.google?.maps || !window.myMap) {
    setConfigurationRequiredState('default');
  }

  const directionsService = mapEnabled && window.google?.maps ? new google.maps.DirectionsService() : null;
  const directionsRenderer = mapEnabled && window.google?.maps ? new google.maps.DirectionsRenderer({
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#3A5A40',
      strokeWeight: 4,
    },
  }) : null;

  if (directionsRenderer && window.myMap) {
    directionsRenderer.setMap(window.myMap);
  }

  const searchForm = createSearchFormController({ apiGet, notify });
  const itineraryController = createMapItineraryController({
    state,
    directionsService,
    directionsRenderer,
    getSearchPayload: searchForm.getPayload,
    apiPost,
    notify,
    mapEnabled,
  });
  const manualMonumentController = createManualMonumentController({
    state,
    displayMonumentsOnly: itineraryController.displayMonumentsOnly,
    notify,
  });

  searchForm.init();
  setupPlannerPresets({ searchForm, notify });
  restoreRecentSearch({ searchForm, itineraryController });
  setupSearchButton({ searchForm, itineraryController, notify });
  const currentLocationButton = document.getElementById('current-location-button');
  if (currentLocationButton) {
    currentLocationButton.addEventListener('click', forceCurrentLocation);
  }
  setupCenterRouteButton({ itineraryController });
  setupSaveButton({ itineraryController });
  setupFavoriteButtons({ notify });
  setupAddMonumentButton({ manualMonumentController, notify });
  document.addEventListener('route-state-change', syncRouteActionButtons);
  syncRouteActionButtons();
}
