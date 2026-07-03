import { apiDelete, apiGet, apiPost } from './api.js';
import {
  clearStatusMessage,
  escapeHtml,
  getErrorMessage,
  isValidNumericId,
  setButtonBusy,
  setStatusMessage,
  showFavoriteNameModal,
  stripHtml,
} from './ui.js';

const DEFAULT_MAP_OPTIONS = {
  zoom: 12,
  center: { lat: 38.7223, lng: -9.1393 },
};

let map;
let directionsRenderer;
let isFavorited = true;
let favoriteRouteId = null;
let currentRouteDetails = null;

function getStatusElement() {
  return document.getElementById('route-status');
}

function getRouteContainer() {
  return document.getElementById('custom-itinerary-container');
}

function getToggleFavoriteButton() {
  return document.getElementById('toggle-favorite-button');
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

function setRouteStatus(message, type = 'info') {
  setStatusMessage(getStatusElement(), message, type);
}

function clearRouteStatus() {
  clearStatusMessage(getStatusElement());
}

function setToggleButtonState() {
  const button = getToggleFavoriteButton();
  if (!button) {
    return;
  }

  button.textContent = isFavorited ? 'Remove from Favorites' : 'Save as Favorite';
  button.dataset.state = isFavorited ? 'favorited' : 'not-favorited';
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
  wrapper.appendChild(createTextElement('h2', title));
  wrapper.appendChild(createTextElement('p', description));
  return wrapper;
}

function renderRoutePlaceholder(title, description) {
  const container = getRouteContainer();
  if (!container) {
    return;
  }

  container.replaceChildren(createEmptyState(title, description));
}

window.initMap = function initMap() {
  const mapElement = document.getElementById('map');
  if (!mapElement) {
    setRouteStatus('Map container not found.', 'error');
    return;
  }

  try {
    map = new google.maps.Map(mapElement, DEFAULT_MAP_OPTIONS);
    directionsRenderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: '#3A5A40',
        strokeWeight: 4,
      },
    });

    setToggleButtonState();
    getToggleFavoriteButton()?.addEventListener('click', toggleFavorite);
    loadRouteDetails();
  } catch (error) {
    setRouteStatus('Could not initialize Google Maps. Please refresh the page.', 'error');
  }
};

async function loadRouteDetails() {
  const params = new URLSearchParams(window.location.search);
  const routeId = params.get('favoriteId');

  if (!routeId || !isValidNumericId(routeId)) {
    renderRoutePlaceholder('Route not found', 'Open this page from a saved favorite itinerary.');
    setRouteStatus('Missing or invalid favorite itinerary ID.', 'error');
    getToggleFavoriteButton()?.setAttribute('disabled', 'disabled');
    return;
  }

  favoriteRouteId = routeId;
  setRouteStatus('Loading route details...', 'info');

  try {
    const routeDetails = await apiGet(`/favorites/${routeId}`);
    if (!routeDetails || Object.keys(routeDetails).length === 0) {
      renderRoutePlaceholder('Route not found', 'This favorite itinerary is no longer available.');
      setRouteStatus('No route details were found for this favorite.', 'warning');
      return;
    }

    currentRouteDetails = routeDetails;
    displayRouteDetails(routeDetails);
    clearRouteStatus();
  } catch (error) {
    renderRoutePlaceholder('Could not load route', getErrorMessage(error));
    setRouteStatus('Could not load this route. Please try again later.', 'error');
  }
}

function displayRouteDetails(routeDetails) {
  const { itinerary, map_data } = routeDetails;
  const monuments = Array.isArray(itinerary?.monuments) ? itinerary.monuments : [];

  if (monuments.length === 0) {
    renderRoutePlaceholder('Empty itinerary', 'This favorite route has no monuments saved.');
    setRouteStatus('This itinerary does not contain monuments.', 'warning');
    return;
  }

  renderMarkersAndRoute(monuments, map_data);
  displayCustomItinerary({ ...itinerary, monuments }, map_data);
}

function renderMarkersAndRoute(monuments, mapData) {
  if (!map || !directionsRenderer) {
    return;
  }

  const bounds = new google.maps.LatLngBounds();
  let markerCount = 0;

  monuments.forEach((monument) => {
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
      title: monument.name || 'Monument',
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `<h3>${escapeHtml(monument.name || 'Monument')}</h3><p>${escapeHtml(monument.address || '')}</p>`,
    });

    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });

    bounds.extend(position);
    markerCount += 1;
  });

  if (markerCount > 0 && !bounds.isEmpty()) {
    map.fitBounds(bounds);
  }

  if (mapData?.routes) {
    directionsRenderer.setDirections(mapData);
  }
}

function renderRouteLegs(container, directionsResult) {
  const legs = directionsResult?.routes?.[0]?.legs;
  if (!Array.isArray(legs) || legs.length === 0) {
    container.appendChild(createEmptyState(
      'Route directions unavailable',
      'The saved monuments are visible, but turn-by-turn directions were not stored for this favorite.'
    ));
    return;
  }

  const title = createTextElement('h2', 'Itinerary');
  container.appendChild(title);

  legs.forEach((leg) => {
    const legDiv = document.createElement('div');
    legDiv.className = 'leg-item';

    const summary = document.createElement('p');
    const start = createTextElement('strong', leg.start_address || 'Start');
    const separator = document.createTextNode(' → ');
    const end = createTextElement('strong', leg.end_address || 'Destination');
    summary.append(start, separator, end);

    const meta = createTextElement(
      'p',
      `Distance: ${leg.distance?.text || 'N/A'} | Duration: ${leg.duration?.text || 'N/A'}`,
      'leg-meta'
    );

    const instructionsLabel = createTextElement('p', 'Instructions:', 'instructions-label');
    const stepsList = document.createElement('ul');
    stepsList.className = 'route-steps';

    const steps = Array.isArray(leg.steps) ? leg.steps : [];
    if (steps.length === 0) {
      stepsList.appendChild(createTextElement('li', 'No turn-by-turn instructions available.'));
    } else {
      steps.forEach((step) => {
        stepsList.appendChild(createTextElement('li', stripHtml(step.instructions || '')));
      });
    }

    legDiv.append(summary, meta, instructionsLabel, stepsList);
    container.appendChild(legDiv);
  });
}

function renderMonuments(container, monuments) {
  const monumentsDiv = document.createElement('div');
  monumentsDiv.className = 'monuments-container';

  monumentsDiv.appendChild(createTextElement('h2', 'Monuments'));
  const list = document.createElement('ol');

  monuments.forEach((monument) => {
    const item = document.createElement('li');
    const name = createTextElement('strong', monument.name || 'Unnamed monument');
    const address = document.createTextNode(` (${monument.address || 'address unavailable'})`);
    item.append(name, address);
    list.appendChild(item);
  });

  monumentsDiv.appendChild(list);
  container.appendChild(monumentsDiv);
}

function displayCustomItinerary(itinerary, directionsResult) {
  const itineraryContainer = getRouteContainer();
  if (!itineraryContainer) {
    return;
  }

  itineraryContainer.replaceChildren();
  renderRouteLegs(itineraryContainer, directionsResult);
  renderMonuments(itineraryContainer, itinerary.monuments);
}

async function removeFavorite(button) {
  if (!isValidNumericId(favoriteRouteId)) {
    setRouteStatus('Invalid favorite itinerary ID.', 'error');
    return;
  }

  const restoreButton = setButtonBusy(button, 'Removing...');
  try {
    await apiDelete(`/favorites/${favoriteRouteId}`);
    isFavorited = false;
    setToggleButtonState();
    setRouteStatus('Route removed from favorites. You can save it again from this page.', 'success');
  } catch (error) {
    setRouteStatus(getErrorMessage(error, 'Could not remove this route from favorites.'), 'error');
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
      const data = await apiPost('/favorites', {
        name: favoriteName,
        itinerary: currentRouteDetails.itinerary,
        map_data: currentRouteDetails.map_data || {},
      });

      favoriteRouteId = data.favoriteId;
      currentRouteDetails = data.favorite || currentRouteDetails;
      isFavorited = true;
      setRouteStatus('Route saved as favorite.', 'success');
    } catch (error) {
      setRouteStatus(getErrorMessage(error, 'Could not save this route as favorite.'), 'error');
    } finally {
      restoreButton();
      setToggleButtonState();
    }
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
