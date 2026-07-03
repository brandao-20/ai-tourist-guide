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

  const searchSection = document.querySelector('.search-section');
  const monumentDiv = document.createElement('div');
  monumentDiv.className = 'monument-list';
  monumentDiv.innerHTML = '<h2>Monuments to Visit:</h2><ol></ol>';
  searchSection.appendChild(monumentDiv);

  return monumentDiv.querySelector('ol');
}

function ensureItineraryContainer() {
  let itineraryContainer = document.getElementById('itinerary-ordered-list');
  if (itineraryContainer) {
    return itineraryContainer;
  }

  const searchSection = document.querySelector('.search-section');
  const itineraryDiv = document.createElement('div');
  itineraryDiv.className = 'itinerary-list';
  itineraryDiv.innerHTML = '<h2>Itinerary</h2><ol id="itinerary-ordered-list"></ol>';
  searchSection.appendChild(itineraryDiv);

  return itineraryDiv.querySelector('ol');
}

function createMonumentButton(label, className, onClick) {
  const button = document.createElement('button');
  button.textContent = label;
  button.className = className;
  button.style.marginLeft = label.length === 1 ? '5px' : '10px';
  button.addEventListener('click', onClick);
  return button;
}

function renderMonumentList(monuments, actions) {
  const monumentList = ensureMonumentList();
  monumentList.replaceChildren();

  if (!Array.isArray(monuments) || monuments.length === 0) {
    renderEmptyListItem(monumentList, 'No monuments selected yet. Run a search to start building an itinerary.');
    return;
  }

  monuments.forEach((monument, index) => {
    const li = document.createElement('li');
    li.className = 'monument-item';
    li.dataset.index = String(index);

    const monumentInfo = document.createElement('span');
    monumentInfo.textContent = `${monument.name} (${monument.address})`;

    li.appendChild(monumentInfo);
    li.appendChild(createMonumentButton('View', 'view-button', () => actions.view(index)));
    li.appendChild(createMonumentButton('Remove', 'remove-button', () => actions.remove(index)));
    li.appendChild(createMonumentButton('↑', 'move-up-button', () => actions.moveUp(index)));
    li.appendChild(createMonumentButton('↓', 'move-down-button', () => actions.moveDown(index)));

    monumentList.appendChild(li);
  });
}

function createTextElement(tagName, text, className) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text || '';
  return element;
}

function renderEmptyListItem(container, message) {
  const item = createTextElement('li', message, 'empty-state');
  container.appendChild(item);
}

function renderItinerary(directionsResult, notify) {
  const itineraryContainer = ensureItineraryContainer();
  itineraryContainer.replaceChildren();

  const legs = directionsResult?.routes?.[0]?.legs;
  if (!Array.isArray(legs) || legs.length === 0) {
    renderEmptyListItem(itineraryContainer, 'No route segments available yet.');
    notify.error('Failed to retrieve route segments.');
    return;
  }

  legs.forEach((leg) => {
    const legItem = document.createElement('li');
    legItem.className = 'leg-item';

    const summary = document.createElement('p');
    summary.append(
      createTextElement('strong', leg.start_address || 'Start'),
      document.createTextNode(' → '),
      createTextElement('strong', leg.end_address || 'Destination')
    );

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

    legItem.append(summary, meta, instructionsLabel, stepsList);
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
  const selectedTravelMode = document.getElementById('travel-mode')?.value || 'DRIVING';
  return google.maps.TravelMode[selectedTravelMode] || google.maps.TravelMode.DRIVING;
}

export function createMapItineraryController({
  state,
  directionsService,
  directionsRenderer,
  getSearchPayload,
  apiPost,
  notify,
}) {
  const actions = {
    remove,
    moveUp,
    moveDown,
    view,
  };

  function setMonuments(monuments) {
    state.currentMonuments = Array.isArray(monuments) ? monuments : [];
  }

  function displayMonumentsOnly(monuments) {
    setMonuments(monuments);
    renderMonumentList(state.currentMonuments, actions);
    plotMarkersOnMap(state.currentMonuments);
  }

  function displayItineraryAndMonuments(monuments, directionsResult, options = {}) {
    setMonuments(monuments);
    state.lastDirectionsResult = directionsResult;
    renderItinerary(directionsResult, notify);
    renderMonumentList(state.currentMonuments, actions);
    plotMarkersOnMap(state.currentMonuments);

    if (options.showSuccess !== false) {
      notify.success('Itinerary updated successfully!');
    }
  }

  function remove(index) {
    const monument = state.currentMonuments[index];
    if (!monument) {
      notify.error('Monument not found.');
      return;
    }

    const confirmation = confirm(`Are you sure you want to remove the monument "${monument.name}"?`);
    if (!confirmation) {
      return;
    }

    state.currentMonuments.splice(index, 1);
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
    displayMonumentsOnly(state.currentMonuments);
  }

  function view(index) {
    const monument = state.currentMonuments[index];
    if (!monument) {
      notify.error('Monument not found.');
      return;
    }

    if (!hasValidCoordinates(monument)) {
      notify.error('Monument coordinates are not available.');
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

  async function saveMonuments() {
    if (state.currentMonuments.length < 2) {
      notify.error('Please add at least two monuments to generate a route.');
      return;
    }

    const invalidMonument = state.currentMonuments.find((monument) => !hasValidCoordinates(monument));
    if (invalidMonument) {
      notify.error(`Monument "${invalidMonument.name}" has invalid coordinates.`);
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
        notify.error('Could not calculate the route. Please check the order of the monuments.');
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
      notify.warning('Route generated, but the recent search could not be saved.');
    }
  }

  function plotMarkersOnMap(monuments) {
    if (!window.myMap) {
      notify.error('Map not initialized.');
      return;
    }

    clearMarkers(state);
    const bounds = new google.maps.LatLngBounds();

    monuments.forEach((monument) => {
      if (!hasValidCoordinates(monument)) {
        notify.warning(`Monument "${monument.name}" does not have valid coordinates.`);
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

  return {
    displayMonumentsOnly,
    displayItineraryAndMonuments,
    saveMonuments,
  };
}
