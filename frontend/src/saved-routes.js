import { apiDelete, apiGet, apiPatch } from './api.js';
import { downloadRouteHtml, downloadRouteJson } from './routeExport.js';
import { clearStatusMessage, getElement, getErrorMessage, setButtonBusy, setStatusMessage, showConfirmDialog, showToast } from './ui.js';
import { formatDate } from './formatters.js';
import { createRouteSubtitle, getDisplayStopName, getValidCoordinates, normalizePlaceName, truncateText } from './routePresentation.js';
import { loadGoogleMapsScript } from './googleMapsLoader.js';

import { requireAuthenticatedSession, setupLogoutButton } from './session.js';
setupLogoutButton();
const DEFAULT_MAP_CENTER = { lat: 39.6, lng: -8.0 };

function decodePolyline(encodedPolyline = '') {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encodedPolyline.length) {
    let result = 0;
    let shift = 0;
    let byte = null;

    do {
      byte = encodedPolyline.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encodedPolyline.length);

    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;

    do {
      byte = encodedPolyline.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encodedPolyline.length);

    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

function getRouteMetadata(favorite) {
  return favorite?.map_data?.routeMetadata || favorite?.map_data?.routes?.routeMetadata || null;
}

const state = {
  favorites: [],
  filteredFavorites: [],
  mapsReady: false,
  renameFavoriteId: null,
  pendingDeleteFavorite: null,
  currentPage: 1,
  pageSize: 6,
};

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
  const routeMetadata = getRouteMetadata(favorite);
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  const firstMonument = monuments[0];
  const lastMonument = monuments[monuments.length - 1];

  return {
    stops: monuments.length,
    days: getDays(favorite),
    legs: legs.length,
    firstStop: normalizePlaceName(firstLeg?.start_address || firstMonument?.name || firstMonument?.address, 'Origin unavailable', 58),
    lastStop: normalizePlaceName(lastLeg?.end_address || lastMonument?.name || lastMonument?.address, 'Destination unavailable', 58),
    distanceText: routeMetadata?.distanceText || '',
    durationText: routeMetadata?.durationText || '',
    hasRouteMetadata: Boolean(routeMetadata),
    updatedAt: formatDate(favorite?.updatedAt || favorite?.createdAt, 'Unknown'),
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
  const origin = monuments[0]?.address || monuments[0]?.name;
  const destination = monuments[monuments.length - 1]?.address || monuments[monuments.length - 1]?.name;
  const waypoints = monuments.slice(1, -1).map((monument) => monument.address || monument.name).filter(Boolean);

  if (origin && destination && origin !== destination) {
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);
    if (waypoints.length > 0) {
      url.searchParams.set('waypoints', waypoints.slice(0, 9).join('|'));
    }
    return url.toString();
  }

  if (!origin) return 'https://www.google.com/maps';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(origin)}`;
}

function renderMapPreview(favorite, mapElement) {
  const routeMetadata = getRouteMetadata(favorite);
  if (!state.mapsReady) {
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

    if (routeMetadata?.encodedPolyline) {
      const path = decodePolyline(routeMetadata.encodedPolyline);
      if (path.length >= 2) {
        const polyline = new google.maps.Polyline({
          path,
          strokeColor: '#31543f',
          strokeOpacity: 0.95,
          strokeWeight: 4,
        });
        polyline.setMap(map);
        const bounds = new google.maps.LatLngBounds();
        path.forEach((point) => bounds.extend(point));
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds);
        }
        return;
      }
    }

    const monuments = getMonuments(favorite);
    const bounds = new google.maps.LatLngBounds();
    const path = [];
    monuments.forEach((monument, index) => {
      const position = getValidCoordinates(monument);
      if (!position) {
        return;
      }
      path.push(position);
      new google.maps.Marker({
        position,
        map,
        label: String(index + 1),
        title: getDisplayStopName(monument, `Stop ${index + 1}`),
      });
      bounds.extend(position);
    });

    if (path.length >= 2) {
      new google.maps.Polyline({
        path,
        map,
        strokeColor: '#31543f',
        strokeOpacity: 0.82,
        strokeWeight: 4,
      });
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 34);
    }
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
    showToast('Route name updated.', 'success');
    applyFilters();
  } catch (err) {
    setStatusMessage(error, getErrorMessage(err, 'Could not rename this route.'), 'error');
  } finally {
    restoreButton();
  }
}

async function openDeleteDialog(favorite) {
  if (!favorite?.id) {
    showToast('This saved route could not be identified.', 'error');
    return;
  }

  const confirmed = await showConfirmDialog({
    title: 'Remove saved route?',
    description: `“${favorite.name || 'Saved route'}” will be permanently removed from your saved routes.`,
    confirmLabel: 'Remove route',
    cancelLabel: 'Cancel',
    variant: 'danger',
  });

  if (!confirmed) {
    return;
  }

  try {
    await apiDelete(`/favorites/${favorite.id}`);
    state.favorites = state.favorites.filter((item) => Number(item.id) !== Number(favorite.id));
    state.filteredFavorites = state.filteredFavorites.filter((item) => Number(item.id) !== Number(favorite.id));
    showToast('Saved route removed.', 'success');
    applyFilters();
  } catch (err) {
    showToast(getErrorMessage(err, 'Could not remove this route. Please try again.'), 'error');
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
  body.appendChild(createElement('h3', '', truncateText(favorite.name || 'Saved itinerary', 72)));
  body.appendChild(createElement('p', 'favorite-route', createRouteSubtitle(getMonuments(favorite), favorite.map_data, 120)));
  body.appendChild(createMeta([
    `${summary.stops} stops`,
    summary.days > 0 ? `${summary.days} days` : null,
    summary.distanceText && summary.durationText ? `${summary.distanceText} · ${summary.durationText}` : null,
    summary.hasRouteMetadata ? 'Route overview' : 'List only',
    `Updated ${summary.updatedAt}`,
  ]));

  const actions = createElement('div', 'favorite-actions favorite-actions--organised');
  const detailsLink = document.createElement('a');
  detailsLink.href = `/route-details?favoriteId=${encodeURIComponent(favorite.id)}`;
  detailsLink.className = 'action-button action-button--primary favorite-actions__main';
  detailsLink.textContent = 'View details';

  const tools = createElement('div', 'favorite-actions__tools');
  tools.append(
    createButton('Rename', 'action-button action-button--ghost', () => openRenameDialog(favorite)),
    createButton('Export HTML', 'action-button action-button--ghost', () => downloadRouteHtml(favorite, createGoogleMapsUrl(favorite))),
    createButton('Export JSON', 'action-button action-button--ghost', () => downloadRouteJson(favorite)),
    createButton('Remove', 'action-button action-button--danger', () => openDeleteDialog(favorite))
  );

  actions.append(detailsLink, tools);
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
  getElement('metric-updated').textContent = latest ? formatDate(latest, 'Unknown') : '—';
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


function getPaginationElement() {
  let pagination = getElement('favorites-pagination');
  if (pagination) {
    return pagination;
  }

  pagination = createElement('nav', 'pagination-controls');
  pagination.id = 'favorites-pagination';
  pagination.setAttribute('aria-label', 'Saved routes pages');
  getElement('favorites-grid')?.insertAdjacentElement('afterend', pagination);
  return pagination;
}

function renderPagination(totalItems) {
  const pagination = getPaginationElement();
  if (!pagination) {
    return;
  }

  const pageCount = Math.max(1, Math.ceil(totalItems / state.pageSize));
  state.currentPage = Math.min(Math.max(1, state.currentPage), pageCount);
  pagination.replaceChildren();
  pagination.hidden = pageCount <= 1;

  if (pageCount <= 1) {
    return;
  }

  const previous = createButton('Previous', 'action-button action-button--ghost', () => {
    state.currentPage = Math.max(1, state.currentPage - 1);
    applyFilters({ preservePage: true });
  });
  previous.disabled = state.currentPage === 1;
  previous.setAttribute('aria-disabled', String(previous.disabled));

  const label = createElement('span', 'pagination-controls__label', `Page ${state.currentPage} of ${pageCount}`);

  const next = createButton('Next', 'action-button action-button--ghost', () => {
    state.currentPage = Math.min(pageCount, state.currentPage + 1);
    applyFilters({ preservePage: true });
  });
  next.disabled = state.currentPage === pageCount;
  next.setAttribute('aria-disabled', String(next.disabled));

  pagination.append(previous, label, next);
}

function applyFilters({ preservePage = false } = {}) {
  const grid = getElement('favorites-grid');
  const emptyState = getElement('favorites-empty');
  const metrics = document.querySelector('.dashboard-metrics');
  const toolbar = document.querySelector('.library-toolbar');
  const query = normalizeText(getElement('favorite-search')?.value || '');
  const sortValue = getElement('favorite-sort')?.value || 'updated-desc';

  const filtered = state.favorites.filter((favorite) => !query || getSearchableText(favorite).includes(query));
  state.filteredFavorites = sortFavorites(filtered, sortValue);
  if (!preservePage) {
    state.currentPage = 1;
  }

  updateMetrics(state.favorites);
  grid.innerHTML = '';
  grid.setAttribute('aria-busy', 'false');

  const heroActions = getElement('library-hero-actions');

  if (state.favorites.length === 0) {
    metrics?.classList.add('is-hidden');
    toolbar?.classList.add('is-empty');
    heroActions?.classList.add('is-hidden');
    emptyState.classList.remove('is-hidden');
    grid.classList.add('is-hidden');
    emptyState.querySelector('h3').textContent = 'You do not have any saved routes yet.';
    emptyState.querySelector('p').textContent = 'Create your first itinerary and save it for later.';
    renderPagination(0);
    clearStatusMessage(getElement('library-status'));
    return;
  }

  metrics?.classList.remove('is-hidden');
  toolbar?.classList.remove('is-empty');
  heroActions?.classList.remove('is-hidden');

  if (state.filteredFavorites.length === 0) {
    emptyState.classList.remove('is-hidden');
    grid.classList.add('is-hidden');
    emptyState.querySelector('h3').textContent = 'No routes match your filters.';
    emptyState.querySelector('p').textContent = 'Try a different route name, city, stop or sort option.';
    renderPagination(0);
    setStatusMessage(getElement('library-status'), 'No saved routes match the current filters.', 'info');
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

  renderPagination(state.filteredFavorites.length);
  const start = (state.currentPage - 1) * state.pageSize;
  const visibleFavorites = state.filteredFavorites.slice(start, start + state.pageSize);

  visibleFavorites.forEach((favorite) => {
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
      await requireAuthenticatedSession({ next: '/saved-routes' });
      return;
    }

    setStatusMessage(getElement('library-status'), getErrorMessage(error, 'Could not load saved routes.'), 'error');
    grid.setAttribute('aria-busy', 'false');
  }
}

function bindControls() {
  getElement('favorite-search')?.addEventListener('input', () => applyFilters());
  getElement('favorite-sort')?.addEventListener('change', () => applyFilters());
  getElement('rename-dialog')?.addEventListener('submit', renameFavorite);
  getElement('rename-cancel')?.addEventListener('click', () => getElement('rename-dialog')?.close());
}

document.addEventListener('DOMContentLoaded', async () => {
  bindControls();

  const user = await requireAuthenticatedSession({ next: '/saved-routes' });
  if (!user) {
    return;
  }

  try {
    await loadGoogleMapsScript({ libraries: ['routes'] });
    state.mapsReady = true;
  } catch (error) {
    setStatusMessage(getElement('library-status'), 'Map previews are temporarily unavailable. Saved routes are still available as cards and lists.', 'info');
  }

  await loadFavorites();
});
