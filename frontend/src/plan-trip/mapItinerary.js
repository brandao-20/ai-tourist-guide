import { escapeHtml, stripHtml } from '../ui.js';
import { createMapMarker, openMarkerInfoWindow } from '../mapMarker.js';
import { formatDistance, formatDuration } from '../formatters.js';

function hasValidCoordinates(monument) {
  return (
    monument?.coordinates &&
    typeof monument.coordinates.lat === 'number' &&
    typeof monument.coordinates.lng === 'number' &&
    Number.isFinite(monument.coordinates.lat) &&
    Number.isFinite(monument.coordinates.lng)
  );
}

function ensureMonumentList() {
  let monumentList = document.querySelector('.monument-list ol');
  if (monumentList) {
    return monumentList;
  }

  const searchSection = document.querySelector('.search-section') || document.querySelector('.itinerary-card');
  const monumentDiv = document.createElement('div');
  monumentDiv.className = 'monument-list';
  monumentDiv.innerHTML = '<h2>Trip stops</h2><ol></ol>';
  searchSection.appendChild(monumentDiv);

  return monumentDiv.querySelector('ol');
}

function ensureItineraryContainer() {
  let itineraryContainer = document.getElementById('itinerary-ordered-list');
  if (itineraryContainer) {
    return itineraryContainer;
  }

  const searchSection = document.querySelector('.search-section') || document.querySelector('.itinerary-card');
  const itineraryDiv = document.createElement('div');
  itineraryDiv.className = 'itinerary-list';
  itineraryDiv.innerHTML = '<h2>Itinerary</h2><ol id="itinerary-ordered-list"></ol>';
  searchSection.appendChild(itineraryDiv);

  return itineraryDiv.querySelector('ol');
}

function ensureItineraryControls() {
  const itinerarySection = document.querySelector('.itinerary-list');
  if (!itinerarySection) {
    return null;
  }

  let controls = itinerarySection.querySelector('.itinerary-controls');
  if (controls) {
    return controls;
  }

  controls = document.createElement('div');
  controls.className = 'itinerary-controls';

  const expandButton = createMonumentButton('Expand all', 'itinerary-control-button', () => {
    itinerarySection.querySelectorAll('details.day-plan-card').forEach((details) => {
      details.open = true;
    });
  });
  const collapseButton = createMonumentButton('Collapse all', 'itinerary-control-button', () => {
    itinerarySection.querySelectorAll('details.day-plan-card').forEach((details, index) => {
      details.open = index === 0;
    });
  });

  controls.append(expandButton, collapseButton);
  const heading = itinerarySection.querySelector('h2');
  if (heading) {
    heading.insertAdjacentElement('afterend', controls);
  } else {
    itinerarySection.prepend(controls);
  }

  return controls;
}

function setLongItineraryLayout(days = []) {
  const resultsGrid = document.getElementById('planner-results');
  if (!resultsGrid) {
    return;
  }

  const totalActivities = days.reduce((total, day) => total + getDayActivities(day).length, 0);
  resultsGrid.classList.toggle('classic-results-grid--stacked', days.length > 3 || totalActivities > 10);
}

function createMonumentButton(label, className, onClick, title = label) {
  const button = document.createElement('button');
  button.textContent = label;
  button.className = className;
  button.type = 'button';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.addEventListener('click', onClick);
  return button;
}

function createTextElement(tagName, text, className) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text || '';
  return element;
}

function renderEmptyListItem(container, { title = 'Nothing here yet', message }) {
  const item = document.createElement('li');
  item.className = 'empty-state';
  item.appendChild(createTextElement('h3', title));
  item.appendChild(createTextElement('p', message));
  container.appendChild(item);
}

function getMonumentLabel(monument) {
  return monument?.name || 'Unnamed stop';
}

function getMonumentAddress(monument) {
  return monument?.address || 'Address unavailable';
}

function getSelectedTravelModeLabel() {
  return 'Car';
}

function getRouteModeLabel(directions, routeMetadata = null) {
  if (Array.isArray(directions?.routes)) {
    return 'Map route';
  }

  if (routeMetadata) {
    const distance = formatDistance(routeMetadata.distanceMeters);
    const duration = formatDuration(routeMetadata.durationSeconds);
    return `${distance} · ${duration}`;
  }

  return 'Pending';
}

function getDayCount(itinerary) {
  if (Array.isArray(itinerary)) {
    return itinerary.length;
  }

  return 0;
}

function getLegCount(directions) {
  const legs = directions?.routes?.[0]?.legs;
  return Array.isArray(legs) ? legs.length : 0;
}

function renderRouteStats({ monuments = [], directions = null, itinerary = [], routeMetadata = null } = {}) {
  const stats = document.getElementById('route-stats');
  if (!stats) {
    return;
  }

  const safeMonuments = Array.isArray(monuments) ? monuments : [];
  const values = [
    ['Stops', String(safeMonuments.length)],
    ['Days', String(getDayCount(itinerary))],
    ['Route', getLegCount(directions) > 0 ? `${getLegCount(directions)} legs` : getRouteModeLabel(directions, routeMetadata)],
  ];

  stats.replaceChildren(...values.map(([label, value]) => {
    const tile = document.createElement('div');
    tile.className = 'stat-tile';
    tile.append(createTextElement('span', label), createTextElement('strong', value));
    return tile;
  }));
}

function renderMonumentList(monuments, actions) {
  const monumentList = ensureMonumentList();
  monumentList.replaceChildren();

  if (!Array.isArray(monuments) || monuments.length === 0) {
    renderEmptyListItem(monumentList, {
      title: 'No stops yet',
      message: 'Choose a destination and generate an itinerary to add stops to the map.',
    });
    return;
  }

  monuments.forEach((monument, index) => {
    const li = document.createElement('li');
    li.className = 'monument-item';
    li.dataset.index = String(index);
    li.dataset.position = String(index + 1).padStart(2, '0');

    const positionBadge = createTextElement('span', String(index + 1).padStart(2, '0'), 'monument-index');
    positionBadge.setAttribute('aria-hidden', 'true');

    const monumentInfo = document.createElement('div');
    monumentInfo.className = 'monument-info';
    monumentInfo.append(
      createTextElement('strong', getMonumentLabel(monument)),
      createTextElement('span', getMonumentAddress(monument))
    );

    const actionGroup = document.createElement('div');
    actionGroup.className = 'monument-actions';
    actionGroup.append(
      createMonumentButton('View', 'view-button', () => actions.view(index), `View ${getMonumentLabel(monument)} on the map`),
      createMonumentButton('Remove', 'remove-button', () => actions.remove(index), `Remove ${getMonumentLabel(monument)}`),
      createMonumentButton('↑', 'move-up-button', () => actions.moveUp(index), `Move ${getMonumentLabel(monument)} up`),
      createMonumentButton('↓', 'move-down-button', () => actions.moveDown(index), `Move ${getMonumentLabel(monument)} down`)
    );

    li.append(positionBadge, monumentInfo, actionGroup);
    monumentList.appendChild(li);
  });
}

function getActivityLabel(activity) {
  if (typeof activity === 'string') {
    return activity;
  }

  if (!activity || typeof activity !== 'object') {
    return '';
  }

  if (activity.label) {
    return activity.label;
  }

  const period = activity.period && activity.period !== 'flexible'
    ? `${activity.period[0].toUpperCase()}${activity.period.slice(1)}: `
    : '';
  const location = activity.address ? ` (${activity.address})` : '';
  const duration = activity.durationMinutes ? ` · ${activity.durationMinutes} min` : '';
  const reason = activity.reason ? ` — ${activity.reason}` : '';
  return `${period}${activity.name || activity.placeQuery || 'Stop'}${location}${duration}${reason}`;
}

function getDayActivities(day) {
  if (Array.isArray(day.activityDetails) && day.activityDetails.length > 0) {
    return day.activityDetails;
  }

  return Array.isArray(day.activities) ? day.activities : [];
}

function renderGeneratedItinerary(days) {
  const itineraryContainer = ensureItineraryContainer();
  itineraryContainer.replaceChildren();

  if (!Array.isArray(days) || days.length === 0) {
    setLongItineraryLayout([]);
    const controls = ensureItineraryControls();
    if (controls) {
      controls.hidden = true;
    }
    renderEmptyListItem(itineraryContainer, {
      title: 'No timeline yet',
      message: 'Generate an itinerary to build a day-by-day plan.',
    });
    return;
  }

  setLongItineraryLayout(days);
  const controls = ensureItineraryControls();
  if (controls) {
    controls.hidden = days.length < 2;
  }

  days.forEach((day, index) => {
    const dayItem = document.createElement('li');
    dayItem.className = 'generated-day-item generated-day-item--accordion';

    const details = document.createElement('details');
    details.className = 'day-plan-card';
    details.open = index < (days.length > 3 ? 1 : 2);

    const titleText = [
      `Day ${day.day || index + 1}`.trim(),
      day.title || day.city || '',
    ].filter(Boolean).join(' · ');

    const summary = document.createElement('summary');
    summary.className = 'day-plan-summary';
    const summaryText = document.createElement('span');
    summaryText.className = 'day-plan-summary__text';
    summaryText.append(
      createTextElement('strong', titleText),
      createTextElement('span', day.city || 'Route day')
    );
    summary.append(
      createTextElement('span', String(day.day || index + 1).padStart(2, '0'), 'day-plan-index'),
      summaryText,
      createTextElement('span', `${getDayActivities(day).length} stops`, 'day-plan-count')
    );

    const body = document.createElement('div');
    body.className = 'day-plan-body';
    if (day.summary) {
      body.appendChild(createTextElement('p', day.summary, 'generated-day-summary'));
    }

    const activities = document.createElement('ul');
    activities.className = 'generated-activities day-plan-activities';
    const dayActivities = getDayActivities(day);

    if (dayActivities.length === 0) {
      activities.appendChild(createTextElement('li', 'No activities available for this day.'));
    } else {
      dayActivities.forEach((activity) => {
        activities.appendChild(createTextElement('li', getActivityLabel(activity)));
      });
    }

    body.appendChild(activities);
    details.append(summary, body);
    dayItem.appendChild(details);
    itineraryContainer.appendChild(dayItem);
  });
}

function renderDirectionsItinerary(directionsResult, notify) {
  const itineraryContainer = ensureItineraryContainer();
  itineraryContainer.replaceChildren();

  const legs = directionsResult?.routes?.[0]?.legs;
  if (!Array.isArray(legs) || legs.length === 0) {
    renderEmptyListItem(itineraryContainer, {
      title: 'No route segments yet',
      message: 'Build a route after the planner has at least two stops.',
    });
    notify.error('Failed to retrieve route segments.');
    return;
  }

  legs.forEach((leg, index) => {
    const legItem = document.createElement('li');
    legItem.className = 'leg-item';

    const heading = document.createElement('div');
    heading.className = 'leg-heading';
    heading.append(
      createTextElement('span', `Leg ${index + 1}`, 'leg-badge'),
      createTextElement('strong', `${leg.start_address || 'Start'} → ${leg.end_address || 'Destination'}`)
    );

    const meta = createTextElement(
      'p',
      `${leg.distance?.text || 'Distance unavailable'} · ${leg.duration?.text || 'Duration unavailable'} · ${getSelectedTravelModeLabel()}`,
      'leg-meta'
    );

    const instructionsLabel = createTextElement('p', 'Instructions', 'instructions-label');
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

    legItem.append(heading, meta, instructionsLabel, stepsList);
    itineraryContainer.appendChild(legItem);
  });
}

function clearMarkers(state) {
  state.markers.forEach((marker) => {
    if (marker.infoWindow) {
      marker.infoWindow.close();
    }
    marker.setMap(null);
  });
  state.markers = [];
}

function clearRoutePolyline(state) {
  if (state.routePolyline) {
    state.routePolyline.setMap(null);
    state.routePolyline = null;
  }
}

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

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = encodedPolyline.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encodedPolyline.length);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

function drawRoutePolylineFromMetadata(state, routeMetadata) {
  if (!window.google?.maps || !window.myMap || !routeMetadata?.encodedPolyline) {
    clearRoutePolyline(state);
    return false;
  }

  const path = decodePolyline(routeMetadata.encodedPolyline);
  if (path.length < 2) {
    clearRoutePolyline(state);
    return false;
  }

  clearRoutePolyline(state);
  state.routePolyline = new google.maps.Polyline({
    path,
    geodesic: false,
    strokeColor: '#31543f',
    strokeOpacity: 0.95,
    strokeWeight: 5,
  });
  state.routePolyline.setMap(window.myMap);

  const bounds = new google.maps.LatLngBounds();
  path.forEach((point) => bounds.extend(point));
  if (!bounds.isEmpty()) {
    window.myMap.fitBounds(bounds);
  }

  return true;
}

function getTravelModeValue() {
  if (!window.google?.maps?.TravelMode) {
    return 'DRIVING';
  }
  return google.maps.TravelMode.DRIVING;
}

function setPlannerResultsVisible(visible) {
  const results = document.getElementById('planner-results');
  if (results) {
    results.hidden = !visible;
  }
}

export function createMapItineraryController({
  state,
  directionsService,
  directionsRenderer,
  getSearchPayload,
  apiPost,
  notify,
  mapEnabled = true,
}) {
  const actions = {
    remove,
    moveUp,
    moveDown,
    view,
  };

  function isInteractiveMapAvailable() {
    return mapEnabled && Boolean(window.google?.maps && window.myMap);
  }

  function setMonuments(monuments) {
    state.currentMonuments = Array.isArray(monuments) ? monuments : [];
  }

  function displayMonumentsOnly(monuments) {
    setPlannerResultsVisible(state.searchExecuted || (Array.isArray(monuments) && monuments.length > 0));
    setMonuments(monuments);
    clearRoutePolyline(state);
    renderMonumentList(state.currentMonuments, actions);
    renderRouteStats({
      monuments: state.currentMonuments,
      directions: state.lastDirectionsResult,
      itinerary: state.lastItinerary,
      routeMetadata: state.routeMetadata,
    });
    document.dispatchEvent(new CustomEvent('route-state-change'));

    if (isInteractiveMapAvailable()) {
      plotMarkersOnMap(state.currentMonuments);
      if (state.routeMetadata?.encodedPolyline) {
        drawRoutePolylineFromMetadata(state, state.routeMetadata);
      }
    }
  }

  function displaySearchResult({ itinerary, monuments, directions, routeMetadata = null, showSuccess = true }) {
    setPlannerResultsVisible(true);
    setMonuments(monuments);
    state.lastDirectionsResult = directions || null;
    state.routeMetadata = routeMetadata || null;
    renderMonumentList(state.currentMonuments, actions);
    renderRouteStats({ monuments: state.currentMonuments, directions, itinerary, routeMetadata: state.routeMetadata });
    document.dispatchEvent(new CustomEvent('route-state-change'));

    const hasDirectionsRoutes = Array.isArray(directions?.routes) && directions.routes.length > 0;
    if (hasDirectionsRoutes) {
      displayItineraryAndMonuments(state.currentMonuments, directions, { showSuccess, itinerary });
      return;
    }

    renderGeneratedItinerary(itinerary);

    if (isInteractiveMapAvailable()) {
      plotMarkersOnMap(state.currentMonuments);
      if (state.routeMetadata?.encodedPolyline) {
        drawRoutePolylineFromMetadata(state, state.routeMetadata);
      }
    }
  }

  function displayItineraryAndMonuments(monuments, directionsResult, options = {}) {
    setPlannerResultsVisible(true);
    setMonuments(monuments);
    state.lastDirectionsResult = directionsResult;
    renderDirectionsItinerary(directionsResult, notify);
    renderMonumentList(state.currentMonuments, actions);
    renderRouteStats({
      monuments: state.currentMonuments,
      directions: directionsResult,
      itinerary: options.itinerary || state.lastItinerary,
      routeMetadata: state.routeMetadata,
    });
    document.dispatchEvent(new CustomEvent('route-state-change'));

    if (isInteractiveMapAvailable()) {
      clearRoutePolyline(state);
      plotMarkersOnMap(state.currentMonuments);
    }

    if (options.showSuccess !== false) {
      notify.success('Itinerary updated successfully.');
    }
  }

  function remove(index) {
    const monument = state.currentMonuments[index];
    if (!monument) {
      notify.error('Stop not found.');
      return;
    }

    const confirmation = confirm(`Are you sure you want to remove "${monument.name}"?`);
    if (!confirmation) {
      return;
    }

    state.currentMonuments.splice(index, 1);
    state.lastDirectionsResult = null;
    state.routeMetadata = null;
    displayMonumentsOnly(state.currentMonuments);
  }

  function moveUp(index) {
    if (index <= 0 || index >= state.currentMonuments.length) {
      return;
    }

    [state.currentMonuments[index - 1], state.currentMonuments[index]] = [
      state.currentMonuments[index],
      state.currentMonuments[index - 1],
    ];
    state.lastDirectionsResult = null;
    state.routeMetadata = null;
    displayMonumentsOnly(state.currentMonuments);
  }

  function moveDown(index) {
    if (index < 0 || index >= state.currentMonuments.length - 1) {
      return;
    }

    [state.currentMonuments[index + 1], state.currentMonuments[index]] = [
      state.currentMonuments[index],
      state.currentMonuments[index + 1],
    ];
    state.lastDirectionsResult = null;
    state.routeMetadata = null;
    displayMonumentsOnly(state.currentMonuments);
  }

  function view(index) {
    const monument = state.currentMonuments[index];
    if (!monument) {
      notify.error('Stop not found.');
      return;
    }

    if (!isInteractiveMapAvailable()) {
      notify.warning('The interactive map is temporarily unavailable. Your itinerary is still available as a list.');
      return;
    }

    if (!hasValidCoordinates(monument)) {
      notify.error('Stop coordinates are not available.');
      return;
    }

    const position = {
      lat: monument.coordinates.lat,
      lng: monument.coordinates.lng,
    };
    window.myMap.setCenter(position);
    window.myMap.setZoom(15);

    const marker = state.markers[index];
    if (!marker) {
      return;
    }

    if (!marker.infoWindow) {
      marker.infoWindow = new google.maps.InfoWindow({
        content: `<h3>${escapeHtml(monument.name)}</h3><p>${escapeHtml(monument.address)}</p>`,
      });
    }

    marker.infoWindow.open(window.myMap, marker);
  }

  function centerRoute() {
    if (!isInteractiveMapAvailable()) {
      notify.warning('The interactive map is temporarily unavailable. Your itinerary is still available as a list.');
      return;
    }

    if (state.currentMonuments.length === 0) {
      const previewLocation = state.previewLocation || { lat: 39.3999, lng: -8.2245 };
      window.myMap.setCenter({ lat: previewLocation.lat, lng: previewLocation.lng });
      window.myMap.setZoom(previewLocation.source === 'browser' ? 13 : 6);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    state.currentMonuments.forEach((monument) => {
      if (hasValidCoordinates(monument)) {
        bounds.extend({ lat: monument.coordinates.lat, lng: monument.coordinates.lng });
      }
    });

    if (!bounds.isEmpty()) {
      window.myMap.fitBounds(bounds);
    }
  }

  async function refreshRouteMetadata() {
    try {
      const data = await apiPost('/routes/metadata', {
        stops: state.currentMonuments,
        travelMode: 'driving',
      });
      state.routeMetadata = data?.routeMetadata || null;
      return state.routeMetadata;
    } catch (error) {
      state.routeMetadata = null;
      return null;
    }
  }

  async function saveMonuments() {
    if (state.currentMonuments.length < 2) {
      notify.error('Please add at least two stops to build a route.');
      return;
    }

    if (!isInteractiveMapAvailable() || !directionsService || !directionsRenderer) {
      await refreshRouteMetadata();
      await saveRecentSearch(null);
      renderGeneratedItinerary(state.lastItinerary || []);
      notify.warning('The interactive map is temporarily unavailable. Your itinerary is still available as a list.');
      return;
    }

    const invalidMonument = state.currentMonuments.find((monument) => !hasValidCoordinates(monument));
    if (invalidMonument) {
      notify.error(`Stop "${invalidMonument.name}" has invalid coordinates.`);
      return;
    }

    const waypoints = state.currentMonuments.slice(1, -1).map((monument) => ({
      location: new google.maps.LatLng(monument.coordinates.lat, monument.coordinates.lng),
      stopover: true,
    }));

    const origin = new google.maps.LatLng(
      state.currentMonuments[0].coordinates.lat,
      state.currentMonuments[0].coordinates.lng,
    );
    const destinationMonument = state.currentMonuments[state.currentMonuments.length - 1];
    const destination = new google.maps.LatLng(
      destinationMonument.coordinates.lat,
      destinationMonument.coordinates.lng,
    );

    const request = {
      origin,
      destination,
      travelMode: getTravelModeValue(),
      waypoints,
      optimizeWaypoints: false,
    };

    try {
      const result = await directionsService.route(request);
      const hasRoute = result?.status === 'OK' || Array.isArray(result?.routes);
      if (!hasRoute) {
        notify.error('Could not calculate the route. Please check the order of the stops.');
        return;
      }

      directionsRenderer.setDirections(result);
      await refreshRouteMetadata();
      displayItineraryAndMonuments(state.currentMonuments, result);
      await saveRecentSearch(result);
    } catch (error) {
      const metadata = state.routeMetadata || await refreshRouteMetadata();
      if (metadata?.encodedPolyline && drawRoutePolylineFromMetadata(state, metadata)) {
        await saveRecentSearch({
          fallback: true,
          source: 'google-routes-api-polyline',
          routeMetadata: metadata,
          routes: [],
        });
        renderRouteStats({
          monuments: state.currentMonuments,
          directions: null,
          itinerary: state.lastItinerary,
          routeMetadata: metadata,
        });
        notify.warning('Google Maps turn-by-turn directions are unavailable, but the driving route overview is shown on the map.');
        return;
      }

      notify.error('An error occurred while calculating the route. Please check the stop order and try again.');
    }
  }

  async function saveRecentSearch(directionsResult) {
    const payloadRecentSearch = {
      query_params: getSearchPayload(),
      itinerary: state.lastItinerary,
      monuments: state.currentMonuments,
      directions: directionsResult,
      routeMetadata: state.routeMetadata || directionsResult?.routeMetadata || null,
    };

    try {
      await apiPost('/recent_search', payloadRecentSearch);
      localStorage.setItem('recentSearch', JSON.stringify(payloadRecentSearch));
    } catch (error) {
      notify.warning('The itinerary is available, but the recent search could not be saved.');
    }
  }

  function plotMarkersOnMap(monuments) {
    if (!isInteractiveMapAvailable()) {
      return;
    }

    clearMarkers(state);
    const bounds = new google.maps.LatLngBounds();

    monuments.forEach((monument) => {
      if (!hasValidCoordinates(monument)) {
        return;
      }

      const position = {
        lat: monument.coordinates.lat,
        lng: monument.coordinates.lng,
      };
      const marker = createMapMarker({
        position,
        map: window.myMap,
        title: monument.name,
        label: String(state.markers.length + 1),
      });
      const infoWindow = new google.maps.InfoWindow({
        content: `<h3>${escapeHtml(monument.name)}</h3><p>${escapeHtml(monument.address)}</p>`,
      });

      marker?.addListener('click', () => {
        openMarkerInfoWindow(infoWindow, window.myMap, marker);
      });
      if (marker) {
        marker.infoWindow = infoWindow;
        state.markers.push(marker);
      }
      bounds.extend(position);
    });

    if (state.markers.length > 0) {
      window.myMap.fitBounds(bounds);
    }
  }

  renderRouteStats();
  renderMonumentList([], actions);
  renderGeneratedItinerary([]);
  setPlannerResultsVisible(false);

  return {
    displayMonumentsOnly,
    displayItineraryAndMonuments,
    displaySearchResult,
    saveMonuments,
    saveRecentSearch,
    centerRoute,
  };
}
