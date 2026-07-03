import { apiDelete, apiGet, apiPost } from './api.js';
import { isValidNumericId, setButtonBusy, showFavoriteNameModal } from './ui.js';
import { showLoadingIndicator, hideLoadingIndicator } from './mainapp/loader.js';
import { createMapItineraryController } from './mainapp/mapItinerary.js';
import { createManualMonumentController } from './mainapp/manualMonumentModal.js';
import { configureNotifications, createNotifier } from './mainapp/notifications.js';
import { createSearchFormController } from './mainapp/searchForm.js';

const DEFAULT_MAP_OPTIONS = {
  zoom: 6,
  center: { lat: 38.7223, lng: -9.1393 },
};

const state = {
  lastItinerary: null,
  currentFavoriteId: null,
  lastDirectionsResult: null,
  markers: [],
  currentMonuments: [],
  searchExecuted: false,
};

window.initMap = function initMap() {
  window.myMap = new google.maps.Map(document.getElementById('map'), DEFAULT_MAP_OPTIONS);
  initializeApp();
};

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
    favoriteButton.style.display = isFavorited ? 'none' : 'inline-block';
  }
  if (unfavoriteButton) {
    unfavoriteButton.style.display = isFavorited ? 'inline-block' : 'none';
  }
}

function clearFavoriteState() {
  state.currentFavoriteId = null;
  setFavoriteButtonsFavorited(false);
}

function setupSearchButton({ searchForm, itineraryController, notify }) {
  const searchButton = document.getElementById('search-button');
  if (!searchButton) {
    notify.error('Search button not found.');
    return;
  }

  searchButton.addEventListener('click', async () => {
    const payload = searchForm.getPayload();
    const validationErrors = searchForm.validatePayload(payload);

    if (validationErrors.length > 0) {
      validationErrors.forEach((message) => notify.error(message));
      return;
    }

    const restoreButton = setButtonBusy(searchButton, 'Searching...');
    showLoadingIndicator();
    try {
      const result = await apiPost('/search', payload);
      if (result?.error) {
        notify.error('An error occurred while processing your search.');
        return;
      }

      state.lastItinerary = result.itinerary || null;
      itineraryController.displayMonumentsOnly(result.monuments || []);

      if (result.routes) {
        itineraryController.displayItineraryAndMonuments(result.monuments || [], result.routes, { showSuccess: false });
      } else {
        notify.warning('Search completed, but no route was returned.');
      }

      state.searchExecuted = true;
      clearFavoriteState();
    } catch (error) {
      notify.error('An error occurred while sending your search.');
    } finally {
      hideLoadingIndicator();
      restoreButton();
    }
  });
}

function setupSaveButton({ itineraryController }) {
  const saveButton = document.getElementById('save-button');
  if (!saveButton) {
    return;
  }

  saveButton.addEventListener('click', async () => {
    const restoreButton = setButtonBusy(saveButton, 'Saving...');
    try {
      await itineraryController.saveMonuments();
    } finally {
      restoreButton();
    }
  });
}

function setupFavoriteButtons({ notify }) {
  const favoriteButton = document.getElementById('favorite-button');
  const unfavoriteButton = document.getElementById('unfavorite-button');

  if (favoriteButton) {
    favoriteButton.addEventListener('click', () => {
      if (!state.lastDirectionsResult) {
        notify.error('Please save the route before marking it as favorite.');
        return;
      }

      showFavoriteNameModal(async (favoriteName) => {
        const restoreButton = setButtonBusy(favoriteButton, 'Saving...');
        try {
          const payload = {
            name: favoriteName,
            itinerary: {
              days: state.lastItinerary,
              monuments: state.currentMonuments,
            },
            map_data: state.lastDirectionsResult,
          };

          const data = await apiPost('/favorites', payload);
          state.currentFavoriteId = data.favoriteId;
          notify.success('Itinerary marked as favorite!');
          setFavoriteButtonsFavorited(true);
        } catch (error) {
          notify.error('Error marking itinerary as favorite.');
        } finally {
          restoreButton();
        }
      });
    });
  }

  if (unfavoriteButton) {
    unfavoriteButton.addEventListener('click', async () => {
      if (!state.currentFavoriteId || !isValidNumericId(state.currentFavoriteId)) {
        notify.warning('This itinerary is not favorited or does not have a saved ID.');
        return;
      }

      const restoreButton = setButtonBusy(unfavoriteButton, 'Removing...');
      try {
        await apiDelete(`/favorites/${state.currentFavoriteId}`);
        clearFavoriteState();
        notify.success('Itinerary removed from favorites!');
      } catch (error) {
        notify.error('Error removing itinerary from favorites.');
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
      notify.error('Please perform a search before adding a monument.');
      return;
    }

    manualMonumentController.open();
  });
}

function restoreRecentSearch({ searchForm, itineraryController }) {
  const recentSearch = readRecentSearchFromStorage();
  if (!recentSearch) {
    return;
  }

  searchForm.restoreQuery(recentSearch);

  if (Array.isArray(recentSearch.monuments)) {
    itineraryController.displayMonumentsOnly(recentSearch.monuments);
    state.searchExecuted = true;
  }

  if (recentSearch.directions && Array.isArray(recentSearch.monuments)) {
    state.lastItinerary = recentSearch.itinerary || null;
    itineraryController.displayItineraryAndMonuments(recentSearch.monuments, recentSearch.directions, { showSuccess: false });
  }
}

function initializeApp() {
  configureNotifications();
  const notify = createNotifier();

  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#FF0000',
      strokeWeight: 4,
    },
  });
  directionsRenderer.setMap(window.myMap);

  const searchForm = createSearchFormController({ apiGet, notify });
  const itineraryController = createMapItineraryController({
    state,
    directionsService,
    directionsRenderer,
    getSearchPayload: searchForm.getPayload,
    apiPost,
    notify,
  });
  const manualMonumentController = createManualMonumentController({
    state,
    displayMonumentsOnly: itineraryController.displayMonumentsOnly,
    notify,
  });

  searchForm.init();
  restoreRecentSearch({ searchForm, itineraryController });
  setupSearchButton({ searchForm, itineraryController, notify });
  setupSaveButton({ itineraryController });
  setupFavoriteButtons({ notify });
  setupAddMonumentButton({ manualMonumentController, notify });
}
