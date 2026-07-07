import { escapeHtml, stripHtml } from '../ui.js';

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

function getRouteModeLabel(directions) {
  if (Array.isArray(directions?.routes)) {
    return 'Map route';
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

function renderRouteStats({ monuments = [], directions = null, itinerary = [] } = {}) {
  const stats = document.getElementById('route-stats');
  if (!stats) {
    return;
  }

  const safeMonuments = Array.isArray(monuments) ? monuments : [];
  const values = [
    ['Stops', String(safeMonuments.length)],
    ['Days', String(getDayCount(itinerary))],
    ['Route', getLegCount(directions) > 0 ? `${getLegCount(directions)} legs` : getRouteModeLabel(directions)],
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

    li.append(monumentInfo, actionGroup);
    monumentList.appendChild(li);
  });
}

function renderGeneratedItinerary(days) {
  const itineraryContainer = ensureItineraryContainer();
  itineraryContainer.replaceChildren();

  if (!Array.isArray(days) || days.length === 0) {
    renderEmptyListItem(itineraryContainer, {
      title: 'No timeline yet',
      message: 'Generate an itinerary to build a day-by-day plan.',
    });
    return;
  }

  days.forEach((day) => {
    const dayItem = document.createElement('li');
    dayItem.className = 'generated-day-item';

    const title = createTextElement('p', `Day ${day.day || ''}${day.city ? ` · ${day.city}` : ''}`.trim());
    title.className = 'generated-day-meta';

    const activities = document.createElement('ul');
    activities.className = 'generated-activities';
    const dayActivities = Array.isArray(day.activities) ? day.activities : [];

    if (dayActivities.length === 0) {
      activities.appendChild(createTextElement('li', 'No activities available for this day.'));
    } else {
      dayActivities.forEach((activity) => {
        activities.appendChild(createTextElement('li', activity));
      });
    }

    dayItem.append(title, activities);
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
    renderMonumentList(state.currentMonuments, actions);
    renderRouteStats({ monuments: state.currentMonuments, directions: state.lastDirectionsResult, itinerary: state.lastItinerary });
    document.dispatchEvent(new CustomEvent('route-state-change'));

    if (isInteractiveMapAvailable()) {
      plotMarkersOnMap(state.currentMonuments);
    }
  }

  function displaySearchResult({ itinerary, monuments, directions, showSuccess = true }) {
    setPlannerResultsVisible(true);
    setMonuments(monuments);
    state.lastDirectionsResult = directions || null;
    renderMonumentList(state.currentMonuments, actions);
    renderRouteStats({ monuments: state.currentMonuments, directions, itinerary });
    document.dispatchEvent(new CustomEvent('route-state-change'));

    if (directions) {
      displayItineraryAndMonuments(state.currentMonuments, directions, { showSuccess, itinerary });
      return;
    }

    renderGeneratedItinerary(itinerary);

    if (isInteractiveMapAvailable()) {
      plotMarkersOnMap(state.currentMonuments);
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
    });
    document.dispatchEvent(new CustomEvent('route-state-change'));

    if (isInteractiveMapAvailable()) {
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

  async function saveMonuments() {
    if (state.currentMonuments.length < 2) {
      notify.error('Please add at least two stops to build a route.');
      return;
    }

    if (!isInteractiveMapAvailable() || !directionsService || !directionsRenderer) {
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
      displayItineraryAndMonuments(state.currentMonuments, result);
      await saveRecentSearch(result);
    } catch (error) {
      notify.error('An error occurred while calculating the route. Please try again.');
    }
  }

  async function saveRecentSearch(directionsResult) {
    const payloadRecentSearch = {
      query_params: getSearchPayload(),
      itinerary: state.lastItinerary,
      monuments: state.currentMonuments,
      directions: directionsResult,
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
      const marker = new google.maps.Marker({
        position,
        map: window.myMap,
        title: monument.name,
        label: {
          text: String(state.markers.length + 1),
          color: '#ffffff',
          fontWeight: '900',
        },
      });
      const infoWindow = new google.maps.InfoWindow({
        content: `<h3>${escapeHtml(monument.name)}</h3><p>${escapeHtml(monument.address)}</p>`,
      });

      marker.addListener('click', () => {
        infoWindow.open(window.myMap, marker);
      });
      marker.infoWindow = infoWindow;
      state.markers.push(marker);
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
    centerRoute,
  };
}
