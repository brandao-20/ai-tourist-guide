import { apiDelete, apiGet, apiPatch } from './api.js';
import { getGoogleMapsBrowserApiKey } from './config.js';
import { downloadRouteHtml, downloadRouteJson } from './routeExport.js';
import { getErrorMessage, setButtonBusy, setStatusMessage, clearStatusMessage } from './ui.js';

import { setupLogoutButton } from './session.js';
setupLogoutButton();
const DEFAULT_MAP_CENTER = { lat: 39.6, lng: -8.0 };

const state = {
  favorites: [],
  filteredFavorites: [],
  mapsReady: false,
  renameFavoriteId: null,
};

function getElement(id) {
  return document.getElementById(id);
}

function formatDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getMonuments(favorite) {
  return Array.isArray(favorite?.itinerary?.monuments) ? favorite.itinerary.monuments : [];
}

function getDays(favorite) {
  const days = favorite?.itinerary?.days;
  return Array.isArray(days) ? days.length : 0;
}

function getLegs(favorite) {
  const legs = favorite?.map_data?.routes?.[0]?.legs;
  return Array.isArray(legs) ? legs : [];
}

function getRouteSummary(favorite) {
  const monuments = getMonuments(favorite);
  const legs = getLegs(favorite);
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  const firstMonument = monuments[0];
  const lastMonument = monuments[monuments.length - 1];

  return {
    stops: monuments.length,
    days: getDays(favorite),
    legs: legs.length,
    firstStop: firstLeg?.start_address || firstMonument?.name || 'Origin unavailable',
    lastStop: lastLeg?.end_address || lastMonument?.name || 'Destination unavailable',
    updatedAt: formatDate(favorite?.updatedAt || favorite?.createdAt),
  };
}

function getSearchableText(favorite) {
  const monuments = getMonuments(favorite);
  const legs = getLegs(favorite);
  return [
    favorite?.name,
    ...monuments.flatMap((monument) => [monument?.name, monument?.city, monument?.address, monument?.category]),
    ...legs.flatMap((leg) => [leg?.start_address, leg?.end_address]),
  ].map(normalizeText).join(' ');
}

function loadGoogleMapsScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    const apiKey = getGoogleMapsBrowserApiKey();
    if (!apiKey) {
      reject(new Error('Map preview is unavailable.'));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Map preview could not be loaded.'));
    document.head.appendChild(script);
  });
}

function createElement(tagName, className, text = '') {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function createButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function createMeta(items) {
  const meta = createElement('div', 'favorite-meta');
  items.filter(Boolean).forEach((item) => meta.appendChild(createElement('span', '', item)));
  return meta;
}

function createGoogleMapsUrl(favorite) {
  const legs = getLegs(favorite);
  if (legs.length > 0) {
    const origin = legs[0]?.start_address;
    const destination = legs[legs.length - 1]?.end_address;
    const waypoints = legs.slice(0, -1).map((leg) => leg.end_address).filter(Boolean);

    const url = new URL('https://www.google.com/maps/dir/');
    if (origin) url.searchParams.set('api', '1');
    if (origin) url.searchParams.set('origin', origin);
    if (destination) url.searchParams.set('destination', destination);
    if (waypoints.length > 0) url.searchParams.set('waypoints', waypoints.slice(0, 9).join('|'));
    return url.toString();
  }

  const monuments = getMonuments(favorite);
  const first = monuments[0]?.address || monuments[0]?.name;
  if (!first) return 'https://www.google.com/maps';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(first)}`;
}

function renderMapPreview(favorite, mapElement) {
  if (!state.mapsReady || !favorite?.map_data?.routes) {
    mapElement.innerHTML = '<span class="favorite-map__badge">Map unavailable</span>';
    return;
  }

  try {
    const map = new google.maps.Map(mapElement, {
      zoom: 6,
      center: DEFAULT_MAP_CENTER,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    const renderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#31543f',
        strokeWeight: 4,
      },
    });

    renderer.setMap(map);
    renderer.setDirections(favorite.map_data);
  } catch (error) {
    mapElement.innerHTML = '<span class="favorite-map__badge">Preview unavailable</span>';
  }
}

function openRenameDialog(favorite) {
  const dialog = getElement('rename-dialog');
  const input = getElement('rename-input');
  const error = getElement('rename-error');
  if (!dialog || !input) return;

  state.renameFavoriteId = favorite.id;
  input.value = favorite.name || '';
  clearStatusMessage(error);
  dialog.showModal();
  input.focus();
  input.select();
}

async function renameFavorite(event) {
  event.preventDefault();

  const input = getElement('rename-input');
  const error = getElement('rename-error');
  const saveButton = getElement('rename-save');
  const dialog = getElement('rename-dialog');
  const favoriteId = state.renameFavoriteId;
  const name = input?.value.trim() || '';

  if (!favoriteId || !name) {
    setStatusMessage(error, 'Enter a valid route name.', 'error');
    return;
  }

  const restoreButton = setButtonBusy(saveButton, 'Saving...');
  try {
    const result = await apiPatch(`/favorites/${favoriteId}`, { name });
    state.favorites = state.favorites.map((favorite) => (
      Number(favorite.id) === Number(favoriteId) ? result.favorite : favorite
    ));
    dialog.close();
    applyFilters();
  } catch (err) {
    setStatusMessage(error, getErrorMessage(err, 'Could not rename this route.'), 'error');
  } finally {
    restoreButton();
  }
}

async function deleteFavorite(favorite, button) {
  const confirmed = window.confirm(`Remove "${favorite.name || 'this route'}" from your saved routes?`);
  if (!confirmed) return;

  const restoreButton = setButtonBusy(button, 'Removing...');
  try {
    await apiDelete(`/favorites/${favorite.id}`);
    state.favorites = state.favorites.filter((item) => Number(item.id) !== Number(favorite.id));
    applyFilters();
  } catch (error) {
    setStatusMessage(getElement('library-status'), getErrorMessage(error, 'Could not remove this route.'), 'error');
  } finally {
    restoreButton();
  }
}

function createFavoriteCard(favorite) {
  const summary = getRouteSummary(favorite);
  const card = createElement('article', 'favorite-card');

  const mapWrapper = createElement('div', 'favorite-map');
  const mapBadge = createElement('span', 'favorite-map__badge', 'Route preview');
  const mapCanvas = createElement('div', 'favorite-map__canvas');
  mapWrapper.append(mapBadge, mapCanvas);

  const body = createElement('div', 'favorite-body');
  body.appendChild(createElement('h3', '', favorite.name || 'Saved itinerary'));
  body.appendChild(createElement('p', 'favorite-route', `${summary.firstStop} → ${summary.lastStop}`));
  body.appendChild(createMeta([
    `${summary.stops} stops`,
    summary.days > 0 ? `${summary.days} days` : null,
    summary.legs > 0 ? `${summary.legs} legs` : 'Route data',
    `Updated ${summary.updatedAt}`,
  ]));

  const actions = createElement('div', 'favorite-actions');
  const detailsLink = document.createElement('a');
  detailsLink.href = `/route-details?favoriteId=${encodeURIComponent(favorite.id)}`;
  detailsLink.className = 'action-button action-button--primary';
  detailsLink.textContent = 'View details';

  const mapsLink = document.createElement('a');
  mapsLink.href = createGoogleMapsUrl(favorite);
  mapsLink.target = '_blank';
  mapsLink.rel = 'noopener noreferrer';
  mapsLink.className = 'action-button action-button--ghost';
  mapsLink.textContent = 'Open map';

  actions.append(
    detailsLink,
    mapsLink,
    createButton('Rename', 'action-button action-button--ghost', () => openRenameDialog(favorite)),
    createButton('Export HTML', 'action-button action-button--ghost', () => downloadRouteHtml(favorite, createGoogleMapsUrl(favorite))),
    createButton('Export JSON', 'action-button action-button--ghost', () => downloadRouteJson(favorite)),
    createButton('Remove', 'action-button action-button--danger', (event) => deleteFavorite(favorite, event.currentTarget))
  );

  body.appendChild(actions);
  card.append(mapWrapper, body);
  requestAnimationFrame(() => renderMapPreview(favorite, mapCanvas));
  return card;
}

function updateMetrics(favorites) {
  const totalStops = favorites.reduce((sum, favorite) => sum + getRouteSummary(favorite).stops, 0);
  const latest = favorites[0]?.updatedAt || favorites[0]?.createdAt;

  getElement('metric-total').textContent = String(favorites.length);
  getElement('metric-stops').textContent = String(totalStops);
  getElement('metric-updated').textContent = latest ? formatDate(latest) : '—';
}

function sortFavorites(favorites, sortValue) {
  return [...favorites].sort((a, b) => {
    if (sortValue === 'name-asc') {
      return (a.name || '').localeCompare(b.name || '');
    }
    if (sortValue === 'stops-desc') {
      return getRouteSummary(b).stops - getRouteSummary(a).stops;
    }
    if (sortValue === 'days-desc') {
      return getRouteSummary(b).days - getRouteSummary(a).days;
    }

    return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
  });
}

function applyFilters() {
  const grid = getElement('favorites-grid');
  const emptyState = getElement('favorites-empty');
  const metrics = document.querySelector('.dashboard-metrics');
  const toolbar = document.querySelector('.library-toolbar');
  const query = normalizeText(getElement('favorite-search')?.value || '');
  const sortValue = getElement('favorite-sort')?.value || 'updated-desc';

  const filtered = state.favorites.filter((favorite) => !query || getSearchableText(favorite).includes(query));
  state.filteredFavorites = sortFavorites(filtered, sortValue);

  updateMetrics(state.favorites);
  grid.innerHTML = '';
  grid.setAttribute('aria-busy', 'false');

  if (state.favorites.length === 0) {
    metrics?.classList.add('is-hidden');
    toolbar?.classList.add('is-empty');
    emptyState.classList.remove('is-hidden');
    grid.classList.add('is-hidden');
    emptyState.querySelector('h3').textContent = 'You do not have any saved routes yet.';
    emptyState.querySelector('p').textContent = 'Create your first itinerary and save it for later.';
    setStatusMessage(getElement('library-status'), 'No saved routes yet.', 'info');
    return;
  }

  metrics?.classList.remove('is-hidden');
  toolbar?.classList.remove('is-empty');

  if (state.filteredFavorites.length === 0) {
    emptyState.classList.remove('is-hidden');
    grid.classList.add('is-hidden');
    emptyState.querySelector('h3').textContent = 'No routes match your filters.';
    emptyState.querySelector('p').textContent = 'Try a different route name, city, stop or sort option.';
    setStatusMessage(getElement('library-status'), 'No matching routes for the current filters.', 'info');
    return;
  }

  metrics?.classList.remove('is-hidden');
  toolbar?.classList.remove('is-empty');
  emptyState.classList.add('is-hidden');
  grid.classList.remove('is-hidden');
  setStatusMessage(
    getElement('library-status'),
    state.filteredFavorites.length === 1
      ? 'Showing 1 saved route.'
      : `Showing ${state.filteredFavorites.length} saved routes.`,
    'info'
  );

  state.filteredFavorites.forEach((favorite) => {
    grid.appendChild(createFavoriteCard(favorite));
  });
}

async function loadFavorites() {
  const grid = getElement('favorites-grid');
  grid.setAttribute('aria-busy', 'true');

  try {
    state.favorites = await apiGet('/favorites');
    if (!Array.isArray(state.favorites)) {
      state.favorites = [];
    }
    applyFilters();
  } catch (error) {
    if (error?.status === 401) {
      window.location.href = '/login';
      return;
    }

    setStatusMessage(getElement('library-status'), getErrorMessage(error, 'Could not load saved routes.'), 'error');
    grid.setAttribute('aria-busy', 'false');
  }
}

function bindControls() {
  getElement('favorite-search')?.addEventListener('input', applyFilters);
  getElement('favorite-sort')?.addEventListener('change', applyFilters);
  getElement('rename-dialog')?.addEventListener('submit', renameFavorite);
  getElement('rename-cancel')?.addEventListener('click', () => getElement('rename-dialog')?.close());
}

document.addEventListener('DOMContentLoaded', async () => {
  bindControls();

  try {
    await apiGet('/user');
  } catch (error) {
    window.location.href = '/login';
    return;
  }

  try {
    await loadGoogleMapsScript();
    state.mapsReady = true;
  } catch (error) {
    setStatusMessage(getElement('library-status'), 'Map previews are temporarily unavailable. Saved routes are still available as cards and lists.', 'info');
  }

  await loadFavorites();
});
