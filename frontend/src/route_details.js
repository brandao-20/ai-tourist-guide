import { apiDelete, apiGet, apiPost } from './api.js';
import {
  copyRouteSummary,
  createGoogleMapsDirectionsUrl,
  downloadRouteHtml,
  downloadRouteJson,
} from './routeExport.js';
import {
  escapeHtml,
  getErrorMessage,
  isValidNumericId,
  setButtonBusy,
  setStatusMessage,
  showFavoriteNameModal,
  stripHtml,
} from './ui.js';
import { getFallbackLocation, getPreferredMapLocation } from './location.js';

const DEFAULT_LOCATION = getFallbackLocation();

const DEFAULT_MAP_OPTIONS = {
  zoom: 12,
  center: { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng },
  mapTypeControl: false,
  streetViewControl: false,
};

const TRAVEL_MODE_LABELS = {
  DRIVING: 'Driving route',
  WALKING: 'Walking route',
  BICYCLING: 'Cycling route',
  TRANSIT: 'Transit route',
};

let map;
let directionsRenderer;
let routeMarkers = [];
let isFavorited = true;
let favoriteRouteId = null;
let currentRouteDetails = null;

function getStatusElement() {
  return document.getElementById('route-status');
}

function getDirectionsContainer() {
  return document.getElementById('custom-itinerary-container');
}

function getStopsContainer() {
  return document.getElementById('monuments-container');
}

function getToggleFavoriteButton() {
  return document.getElementById('toggle-favorite-button');
}

function getTextValue(value, fallback = 'Not available') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function hasValidCoordinates(monument) {
  return (
    monument?.coordinates &&
    typeof monument.coordinates.lat === 'number' &&
    typeof monument.coordinates.lng === 'number' &&
    Number.isFinite(monument.coordinates.lat) &&
    Number.isFinite(monument.coordinates.lng)
  );
}

function getRouteLegs(directionsResult) {
  const legs = directionsResult?.routes?.[0]?.legs;
  return Array.isArray(legs) ? legs : [];
}

function getPrimaryRoute(directionsResult) {
  return directionsResult?.routes?.[0] || null;
}

function getTravelModeLabel(directionsResult) {
  const requestMode = directionsResult?.request?.travelMode;
  const travelMode = typeof requestMode === 'string' ? requestMode.toUpperCase() : '';
  return TRAVEL_MODE_LABELS[travelMode] || 'Saved route';
}

function parseGoogleMetricValue(metric) {
  return typeof metric?.value === 'number' && Number.isFinite(metric.value) ? metric.value : 0;
}

function formatDistance(meters) {
  if (!meters) {
    return '—';
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  const kilometers = meters / 1000;
  return `${kilometers.toFixed(kilometers >= 10 ? 0 : 1)} km`;
}

function formatDuration(seconds) {
  if (!seconds) {
    return '—';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours <= 0) {
    return `${Math.max(minutes, 1)} min`;
  }

  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

function summarizeDirections(directionsResult) {
  const legs = getRouteLegs(directionsResult);
  return legs.reduce(
    (summary, leg) => ({
      distanceMeters: summary.distanceMeters + parseGoogleMetricValue(leg.distance),
      durationSeconds: summary.durationSeconds + parseGoogleMetricValue(leg.duration),
    }),
    { distanceMeters: 0, durationSeconds: 0 }
  );
}

function setTextContent(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function setRouteStatus(message, type = 'info') {
  setStatusMessage(getStatusElement(), message, type);
}


function createTextElement(tagName, text, className) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text || '';
  return element;
}

function createEmptyState(title, description) {
  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state';
  wrapper.appendChild(createTextElement('h3', title));
  wrapper.appendChild(createTextElement('p', description));
  return wrapper;
}

function renderRoutePlaceholder(title, description) {
  getDirectionsContainer()?.replaceChildren(createEmptyState(title, description));
  getStopsContainer()?.replaceChildren(createEmptyState(title, description));
}

function setToggleButtonState() {
  const button = getToggleFavoriteButton();
  if (!button) {
    return;
  }

  button.textContent = isFavorited ? 'Remove route' : 'Save route';
  button.dataset.state = isFavorited ? 'favorited' : 'not-favorited';
}

function setupFavoriteToggle() {
  setToggleButtonState();
  const button = getToggleFavoriteButton();
  if (button && button.dataset.bound !== 'true') {
    button.addEventListener('click', toggleFavorite);
    button.dataset.bound = 'true';
  }
}

function setMapConfigurationRequiredState(message) {
  const mapElement = document.getElementById('map');
  if (!mapElement) {
    return;
  }

  mapElement.classList.add('map-container--fallback');
  mapElement.innerHTML = `
    <div class="empty-state empty-state--required">
      <h3>Map temporarily unavailable</h3>
      <p>${escapeHtml(message)}</p>
      <p>Your itinerary is still available as a list.</p>
    </div>
  `;
}

function clearMarkers() {
  routeMarkers.forEach((marker) => marker.setMap(null));
  routeMarkers = [];
}

function getRouteName(routeDetails) {
  return getTextValue(routeDetails?.name || routeDetails?.itinerary?.name, 'Saved route');
}

function getCreatedLabel(routeDetails) {
  if (!routeDetails?.createdAt) {
    return 'Saved itinerary';
  }

  try {
    return `Saved ${new Intl.DateTimeFormat('en', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(routeDetails.createdAt))}`;
  } catch (error) {
    return 'Saved itinerary';
  }
}

function getMonumentLocation(monument) {
  return getTextValue(monument.address || monument.location || monument.city, 'Address unavailable');
}

function getRouteEndpointLabels(monuments, directionsResult) {
  const legs = getRouteLegs(directionsResult);
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];

  return {
    origin: getTextValue(firstLeg?.start_address || monuments[0]?.address || monuments[0]?.name, 'Origin unavailable'),
    destination: getTextValue(
      lastLeg?.end_address || monuments[monuments.length - 1]?.address || monuments[monuments.length - 1]?.name,
      'Destination unavailable'
    ),
  };
}

function setHeroSummary(routeDetails, monuments, directionsResult) {
  const routeName = getRouteName(routeDetails);
  const createdLabel = getCreatedLabel(routeDetails);
  const legs = getRouteLegs(directionsResult);
  const summary = summarizeDirections(directionsResult);
  const title = document.getElementById('route-title');
  const description = document.getElementById('route-description');

  if (title) {
    title.textContent = routeName;
  }

  if (description) {
    description.textContent = `${createdLabel}. Review ${monuments.length} stops, ${legs.length} route legs and the saved route context.`;
  }

  setTextContent('hero-route-status', 'Ready');
  setTextContent(
    'hero-route-meta',
    `${formatDistance(summary.distanceMeters)} · ${formatDuration(summary.durationSeconds)} · ${getTravelModeLabel(directionsResult)}`
  );
}

function setOverviewMetrics(monuments, directionsResult) {
  const legs = getRouteLegs(directionsResult);
  const summary = summarizeDirections(directionsResult);

  setTextContent('overview-stops', String(monuments.length));
  setTextContent('overview-legs', String(legs.length));
  setTextContent('overview-distance', formatDistance(summary.distanceMeters));
  setTextContent('overview-duration', formatDuration(summary.durationSeconds));
  setTextContent('stops-count-pill', `${monuments.length} ${monuments.length === 1 ? 'stop' : 'stops'}`);
  setTextContent('route-mode-pill', getTravelModeLabel(directionsResult));
}

function renderMiniSummary(monuments, directionsResult) {
  const container = document.getElementById('route-mini-summary');
  if (!container) {
    return;
  }

  const endpoints = getRouteEndpointLabels(monuments, directionsResult);
  container.replaceChildren(
    createTextElement('span', 'Origin'),
    createTextElement('strong', endpoints.origin),
    createTextElement('span', 'Destination'),
    createTextElement('strong', endpoints.destination)
  );
}

function setGoogleMapsExternalLink(monuments) {
  const link = document.getElementById('open-google-maps-link');
  if (!link) {
    return;
  }

  const url = createGoogleMapsDirectionsUrl(monuments);
  if (!url) {
    link.href = '#';
    link.classList.add('is-disabled');
    link.setAttribute('aria-disabled', 'true');
    return;
  }

  link.href = url;
  link.classList.remove('is-disabled');
  link.setAttribute('aria-disabled', 'false');
}

function getRouteGoogleMapsUrl() {
  const monuments = Array.isArray(currentRouteDetails?.itinerary?.monuments)
    ? currentRouteDetails.itinerary.monuments
    : [];
  return createGoogleMapsDirectionsUrl(monuments);
}

function setExportActionsEnabled(isEnabled) {
  ['print-route-button', 'export-html-button', 'export-json-button', 'copy-summary-button'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = !isEnabled;
      button.setAttribute('aria-disabled', String(!isEnabled));
    }
  });
}

function requireLoadedRouteForExport() {
  if (!currentRouteDetails) {
    setRouteStatus('Route details are not loaded yet.', 'warning');
    return false;
  }

  return true;
}

function printRoute() {
  if (!requireLoadedRouteForExport()) {
    return;
  }

  window.print();
}

function exportRouteHtml() {
  if (!requireLoadedRouteForExport()) {
    return;
  }

  downloadRouteHtml(currentRouteDetails, getRouteGoogleMapsUrl());
  setRouteStatus('Printable HTML route export downloaded.', 'success');
}

function exportRouteJson() {
  if (!requireLoadedRouteForExport()) {
    return;
  }

  downloadRouteJson(currentRouteDetails);
  setRouteStatus('Route JSON export downloaded.', 'success');
}

async function copySummary() {
  if (!requireLoadedRouteForExport()) {
    return;
  }

  const button = document.getElementById('copy-summary-button');
  const restoreButton = setButtonBusy(button, 'Copying...');
  try {
    await copyRouteSummary(currentRouteDetails, getRouteGoogleMapsUrl());
    setRouteStatus('Route summary copied to clipboard.', 'success');
  } catch (error) {
    setRouteStatus(getErrorMessage(error, 'Could not copy route summary.'), 'error');
  } finally {
    restoreButton();
  }
}

function bindExportActions() {
  const actions = [
    ['print-route-button', printRoute],
    ['export-html-button', exportRouteHtml],
    ['export-json-button', exportRouteJson],
    ['copy-summary-button', copySummary],
  ];

  actions.forEach(([id, handler]) => {
    const button = document.getElementById(id);
    if (button && button.dataset.bound !== 'true') {
      button.addEventListener('click', handler);
      button.dataset.bound = 'true';
    }
  });

  setExportActionsEnabled(Boolean(currentRouteDetails));
}

function renderMarkersAndRoute(monuments, directionsResult) {
  if (!map || !directionsRenderer) {
    return;
  }

  clearMarkers();
  directionsRenderer.set('directions', null);

  const bounds = new google.maps.LatLngBounds();
  let markerCount = 0;

  monuments.forEach((monument, index) => {
    if (!hasValidCoordinates(monument)) {
      return;
    }

    const position = {
      lat: monument.coordinates.lat,
      lng: monument.coordinates.lng,
    };

    const marker = new google.maps.Marker({
      position,
      map,
      label: String(index + 1),
      title: monument.name || 'Stop',
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `<strong>${escapeHtml(monument.name || 'Stop')}</strong><p>${escapeHtml(getMonumentLocation(monument))}</p>`,
    });

    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });

    routeMarkers.push(marker);
    bounds.extend(position);
    markerCount += 1;
  });

  if (directionsResult?.routes) {
    directionsRenderer.setDirections(directionsResult);
  }

  if (markerCount > 0 && !bounds.isEmpty()) {
    map.fitBounds(bounds);
  }
}

function renderStops(monuments) {
  const container = getStopsContainer();
  if (!container) {
    return;
  }

  if (!monuments.length) {
    container.replaceChildren(createEmptyState('No saved stops', 'This saved route does not contain any stops.'));
    return;
  }

  const fragment = document.createDocumentFragment();
  monuments.forEach((monument, index) => {
    const card = document.createElement('article');
    card.className = 'stop-card';

    const indexElement = createTextElement('span', String(index + 1).padStart(2, '0'), 'stop-index');
    const body = document.createElement('div');
    body.className = 'stop-main';

    body.appendChild(createTextElement('h3', getTextValue(monument.name, 'Unnamed stop')));
    body.appendChild(createTextElement('p', getMonumentLocation(monument)));

    if (hasValidCoordinates(monument)) {
      body.appendChild(createTextElement(
        'span',
        `${monument.coordinates.lat.toFixed(5)}, ${monument.coordinates.lng.toFixed(5)}`,
        'coordinates-chip'
      ));
    }

    card.append(indexElement, body);
    fragment.appendChild(card);
  });

  container.replaceChildren(fragment);
}

function renderRouteLegs(directionsResult) {
  const container = getDirectionsContainer();
  if (!container) {
    return;
  }

  const legs = getRouteLegs(directionsResult);
  if (!legs.length) {
    container.replaceChildren(createEmptyState(
      'Route directions unavailable',
      'The saved stops are visible, but turn-by-turn directions were not stored for this route.'
    ));
    return;
  }

  const fragment = document.createDocumentFragment();
  legs.forEach((leg, index) => {
    const legDiv = document.createElement('article');
    legDiv.className = 'leg-item';

    const summary = document.createElement('div');
    summary.className = 'leg-summary';
    const indexElement = createTextElement('span', String(index + 1).padStart(2, '0'), 'leg-index');
    const summaryBody = document.createElement('div');
    summaryBody.appendChild(createTextElement('h3', `${getTextValue(leg.start_address, 'Start')} → ${getTextValue(leg.end_address, 'Destination')}`));
    summaryBody.appendChild(createTextElement('p', `Leg ${index + 1} of ${legs.length}`));
    summary.append(indexElement, summaryBody);

    const meta = document.createElement('div');
    meta.className = 'leg-meta-grid';
    const distanceCard = document.createElement('div');
    distanceCard.className = 'leg-meta-card';
    distanceCard.append(createTextElement('span', 'Distance', 'meta-label'), createTextElement('strong', leg.distance?.text || 'N/A'));
    const durationCard = document.createElement('div');
    durationCard.className = 'leg-meta-card';
    durationCard.append(createTextElement('span', 'Duration', 'meta-label'), createTextElement('strong', leg.duration?.text || 'N/A'));
    meta.append(distanceCard, durationCard);

    const stepsList = document.createElement('ol');
    stepsList.className = 'route-steps';
    const steps = Array.isArray(leg.steps) ? leg.steps : [];
    if (steps.length === 0) {
      stepsList.appendChild(createTextElement('li', 'No turn-by-turn instructions available.'));
    } else {
      steps.slice(0, 8).forEach((step) => {
        stepsList.appendChild(createTextElement('li', stripHtml(step.instructions || '')));
      });
      if (steps.length > 8) {
        stepsList.appendChild(createTextElement('li', `+${steps.length - 8} additional instructions in Google Maps.`));
      }
    }

    legDiv.append(summary, meta, stepsList);
    fragment.appendChild(legDiv);
  });

  container.replaceChildren(fragment);
}

function displayRouteDetails(routeDetails) {
  const { itinerary, map_data } = routeDetails;
  const monuments = Array.isArray(itinerary?.monuments) ? itinerary.monuments : [];

  if (monuments.length === 0) {
    renderRoutePlaceholder('Empty itinerary', 'This saved route has no stops yet.');
    setRouteStatus('This itinerary does not contain stops.', 'warning');
    return;
  }

  setHeroSummary(routeDetails, monuments, map_data);
  setOverviewMetrics(monuments, map_data);
  renderMiniSummary(monuments, map_data);
  setGoogleMapsExternalLink(monuments);
  renderMarkersAndRoute(monuments, map_data);
  renderStops(monuments);
  renderRouteLegs(map_data);
  setExportActionsEnabled(true);

  const primaryRoute = getPrimaryRoute(map_data);
  if (primaryRoute?.summary) {
    setRouteStatus(`Loaded saved route: ${primaryRoute.summary}.`, 'success');
  } else {
    setRouteStatus('Loaded saved stops. Route legs may need to be rebuilt from the planner if directions are missing.', 'warning');
  }
}

async function loadRouteDetails() {
  const params = new URLSearchParams(window.location.search);
  const routeId = params.get('favoriteId');

  if (!routeId || !isValidNumericId(routeId)) {
    renderRoutePlaceholder('Route not found', 'Open this page from a saved route.');
    setRouteStatus('Missing or invalid saved route ID.', 'error');
    getToggleFavoriteButton()?.setAttribute('disabled', 'disabled');
    setExportActionsEnabled(false);
    setTextContent('hero-route-status', 'Unavailable');
    setTextContent('hero-route-meta', 'Open a saved route from the dashboard.');
    return;
  }

  favoriteRouteId = routeId;
  setRouteStatus('Loading route details...', 'info');
  setTextContent('hero-route-status', 'Loading');
  setTextContent('hero-route-meta', 'Fetching saved itinerary data.');

  try {
    const routeDetails = await apiGet(`/favorites/${routeId}`);
    if (!routeDetails || Object.keys(routeDetails).length === 0) {
      renderRoutePlaceholder('Route not found', 'This saved route is no longer available.');
      setRouteStatus('No route details were found for this saved route.', 'warning');
      setTextContent('hero-route-status', 'Missing');
      setTextContent('hero-route-meta', 'This saved route could not be found.');
      setExportActionsEnabled(false);
      return;
    }

    currentRouteDetails = routeDetails;
    displayRouteDetails(routeDetails);
  } catch (error) {
    renderRoutePlaceholder('Could not load route', getErrorMessage(error));
    setRouteStatus('Could not load this route. Please try again later.', 'error');
    setTextContent('hero-route-status', 'Error');
    setTextContent('hero-route-meta', 'The API did not return this saved itinerary.');
    setExportActionsEnabled(false);
  }
}

window.initMap = function initMap() {
  const mapElement = document.getElementById('map');
  if (!mapElement) {
    setRouteStatus('Map container not found.', 'error');
    return;
  }

  if (!window.google?.maps) {
    window.initMapUnavailable('default');
    return;
  }

  try {
    mapElement.classList.remove('map-container--fallback');
    mapElement.innerHTML = '';
    map = new google.maps.Map(mapElement, DEFAULT_MAP_OPTIONS);
    getPreferredMapLocation().then((location) => {
      if (!currentRouteDetails && map) {
        map.setCenter({ lat: location.lat, lng: location.lng });
        map.setZoom(location.source === 'browser' ? 13 : DEFAULT_MAP_OPTIONS.zoom);
      }
    });
    directionsRenderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#3A5A40',
        strokeWeight: 5,
        strokeOpacity: 0.86,
      },
    });

    setupFavoriteToggle();
    loadRouteDetails();
  } catch (error) {
    setRouteStatus('Could not initialize Google Maps. Please refresh the page.', 'error');
  }
};

window.initMapUnavailable = function initMapUnavailable(reason = 'default') {
  const message = reason === 'missing_browser_api_key'
    ? 'The interactive map is temporarily unavailable.'
    : 'The interactive map could not be loaded.';

  map = null;
  directionsRenderer = null;
  setMapConfigurationRequiredState(message);
  setupFavoriteToggle();
  loadRouteDetails();
  setRouteStatus('The map is temporarily unavailable, but your itinerary is still available.', 'warning');
};

async function removeFavorite(button) {
  if (!isValidNumericId(favoriteRouteId)) {
    setRouteStatus('Invalid saved route ID.', 'error');
    return;
  }

  const restoreButton = setButtonBusy(button, 'Removing...');
  try {
    await apiDelete(`/favorites/${favoriteRouteId}`);
    isFavorited = false;
    setToggleButtonState();
    setRouteStatus('Route removed from saved routes. You can save it again from this page.', 'success');
  } catch (error) {
    setRouteStatus(getErrorMessage(error, 'Could not remove this route from saved routes.'), 'error');
  } finally {
    restoreButton();
    setToggleButtonState();
  }
}

function saveFavorite(button) {
  if (!currentRouteDetails?.itinerary) {
    setRouteStatus('Route details are not loaded yet.', 'error');
    return;
  }

  showFavoriteNameModal(async (favoriteName) => {
    const restoreButton = setButtonBusy(button, 'Saving...');
    try {
      const itinerary = {
        ...currentRouteDetails.itinerary,
        name: favoriteName,
      };
      const data = await apiPost('/favorites', {
        name: favoriteName,
        itinerary,
        map_data: currentRouteDetails.map_data || {},
      });

      favoriteRouteId = data.favoriteId;
      currentRouteDetails = data.favorite || { ...currentRouteDetails, name: favoriteName, itinerary };
      isFavorited = true;
      setRouteStatus(
        data.action === 'updated'
          ? 'This route already existed. The saved route was updated instead of duplicated.'
          : 'Route saved successfully.',
        'success'
      );
    } catch (error) {
      setRouteStatus(getErrorMessage(error, 'Could not save this route.'), 'error');
    } finally {
      restoreButton();
      setToggleButtonState();
    }
  }, {
    defaultName: getRouteName(currentRouteDetails),
    description: 'If this route already exists in your account, it will be updated instead of duplicated.',
    submitLabel: 'Save route',
  });
}

function toggleFavorite() {
  const button = getToggleFavoriteButton();
  if (!button) {
    return;
  }

  if (isFavorited) {
    removeFavorite(button);
    return;
  }

  saveFavorite(button);
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindExportActions);
} else {
  bindExportActions();
}
