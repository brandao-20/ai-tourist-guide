import { apiGet } from './api.js';
import { getUploadUrl, getGoogleMapsBrowserApiKey } from './config.js';
import { setupLogoutButton } from './session.js';
import { getFallbackLocation, getPreferredMapLocation } from './location.js';

const DEFAULT_LOCATION = getFallbackLocation();
const DEFAULT_AVATAR = 'default-avatar.svg';

let dashboardMiniMap = null;
let dashboardMiniMapMarker = null;

function getElement(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const element = getElement(id);
    if (element) {
        element.textContent = value;
    }
}

function setImage(id, src, alt) {
    const image = getElement(id);
    if (!image) {
        return;
    }

    image.src = src;
    image.alt = alt;
}

function createTextElement(tagName, text, className) {
    const element = document.createElement(tagName);
    if (className) {
        element.className = className;
    }
    element.textContent = text || '';
    return element;
}

function createStateCard(title, description, action, badge = null) {
    const card = document.createElement('div');
    card.className = 'state-card';

    if (badge) {
        card.appendChild(createTextElement('span', badge, 'state-card__badge'));
    }

    const heading = createTextElement('h3', title);
    card.appendChild(heading);

    if (description) {
        card.appendChild(createTextElement('p', description));
    }

    if (action) {
        const link = document.createElement('a');
        link.href = action.href;
        link.textContent = action.label;
        link.className = 'state-card__link';
        card.appendChild(link);
    }

    return card;
}

function replaceWithState(container, title, description, action, badge = null) {
    if (!container) {
        return;
    }

    container.innerHTML = '';
    container.appendChild(createStateCard(title, description, action, badge));
}

function setDashboardMetric(id, value) {
    const element = getElement(id);
    if (element) {
        element.textContent = value;
    }
}

function hasConfiguredPreferences(user) {
    const preferences = user?.travelPreferences || {};
    return Boolean(
        preferences.notes ||
        (Array.isArray(preferences.favoriteInterests) && preferences.favoriteInterests.length > 0)
    );
}

function setOnboardingStep(id, { complete = false, current = false } = {}) {
    const element = getElement(id);
    if (!element) {
        return;
    }

    element.classList.toggle('is-complete', complete);
    element.classList.toggle('is-current', current && !complete);
    element.setAttribute('aria-label', `${element.querySelector('strong')?.textContent || 'Step'}: ${complete ? 'complete' : 'pending'}`);
}

function updateOnboardingState(user, favorites = [], recentSearch = null) {
    const hasPreferences = hasConfiguredPreferences(user);
    const hasRecentRoute = Boolean(recentSearch?.directions?.routes);
    const hasFavorites = Array.isArray(favorites) && favorites.length > 0;

    setOnboardingStep('step-profile', {
        complete: hasPreferences,
        current: !hasPreferences,
    });
    setOnboardingStep('step-planner', {
        complete: hasRecentRoute,
        current: hasPreferences && !hasRecentRoute,
    });
    setOnboardingStep('step-favorites', {
        complete: hasFavorites,
        current: hasPreferences && hasRecentRoute && !hasFavorites,
    });
}

function setMapUnavailableState(message = 'The interactive map is temporarily unavailable. Your saved routes are still available as cards and lists.') {
    setDashboardMetric('maps-state', 'List view');
    setText('mini-map-caption', 'Map preview temporarily unavailable');
    setDashboardMetric('recent-route-state', 'List view');
    setText('favorites-meta', 'List view available');

    replaceWithState(
        getElement('mini-map'),
        'Map temporarily unavailable',
        message,
        { href: '/plan-trip', label: 'Plan a trip' },
        'List view available'
    );

    replaceWithState(
        getElement('recent-map'),
        'Route preview unavailable',
        'Your recent itinerary is still available as a list when map previews cannot load.',
        { href: '/plan-trip', label: 'Plan a trip' },
        'List view available'
    );

    replaceWithState(
        getElement('recent-summary'),
        'Recent itinerary available as a list',
        'Open the planner to continue with the available itinerary details.',
        { href: '/plan-trip', label: 'Open planner' }
    );

    replaceWithState(
        getElement('favorites-container'),
        'Saved routes available',
        'Open saved routes to review itinerary cards and stop lists.',
        { href: '/saved-routes', label: 'View saved routes' },
        'List view available'
    );
}

function formatDisplayDate(dateValue) {
    if (!dateValue) {
        return 'Unknown date';
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return 'Unknown date';
    }

    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
}

function getFavoriteMonuments(favorite) {
    return Array.isArray(favorite?.itinerary?.monuments) ? favorite.itinerary.monuments : [];
}

function getItineraryDays(itinerary) {
    if (Array.isArray(itinerary?.days)) {
        return itinerary.days.length;
    }

    if (Array.isArray(itinerary)) {
        return itinerary.length;
    }

    return 0;
}

function getRouteLegs(routeData) {
    const legs = routeData?.routes?.[0]?.legs;
    return Array.isArray(legs) ? legs : [];
}

function getRouteSummary(routeData, monuments = []) {
    const legs = getRouteLegs(routeData);
    const firstLeg = legs[0];
    const lastLeg = legs[legs.length - 1];

    return {
        legCount: legs.length,
        firstStop: firstLeg?.start_address || monuments[0]?.name || 'Start unavailable',
        lastStop: lastLeg?.end_address || monuments[monuments.length - 1]?.name || 'Destination unavailable',
        distance: firstLeg?.distance?.text || (legs.length > 0 ? 'Multiple legs' : 'Distance unavailable'),
        duration: firstLeg?.duration?.text || (legs.length > 0 ? 'Multiple legs' : 'Duration unavailable'),
    };
}

function getFavoriteSummary(favorite) {
    const monuments = getFavoriteMonuments(favorite);
    const routeSummary = getRouteSummary(favorite?.map_data, monuments);
    const days = getItineraryDays(favorite?.itinerary);

    return {
        stops: monuments.length,
        days,
        legs: routeSummary.legCount,
        firstStop: routeSummary.firstStop,
        lastStop: routeSummary.lastStop,
        updatedAt: formatDisplayDate(favorite?.updatedAt || favorite?.createdAt),
    };
}

function createMetaList(items) {
    const wrapper = document.createElement('div');
    wrapper.className = 'favorite-card__meta';

    items.forEach((item) => {
        if (!item) {
            return;
        }
        wrapper.appendChild(createTextElement('span', item));
    });

    return wrapper;
}

async function updateUserNameAndImage() {
    const user = await apiGet('/user');
    const displayName = user.name || 'Traveller';

    setText('user-name', displayName);
    setText('hero-user-name', displayName.split(' ')[0] || displayName);
    setImage(
        'profile-pic',
        user.profileImage ? getUploadUrl(user.profileImage) : DEFAULT_AVATAR,
        `${displayName} profile picture`
    );

    return user;
}

async function applyDashboardMapLocation(location, { forced = false } = {}) {
    const mapElement = getElement('mini-map');
    if (!mapElement || !window.google?.maps) {
        return;
    }

    const center = { lat: location.lat, lng: location.lng };

    if (!dashboardMiniMap) {
        mapElement.innerHTML = '';
        dashboardMiniMap = new google.maps.Map(mapElement, {
            center,
            zoom: location.source === 'browser' || location.source === 'cached' ? 13 : 6,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
        });

        dashboardMiniMap.addListener('click', () => {
            window.location.href = '/plan-trip';
        });

        mapElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                window.location.href = '/plan-trip';
            }
        });
    } else {
        dashboardMiniMap.setCenter(center);
        dashboardMiniMap.setZoom(location.source === 'browser' || location.source === 'cached' ? 13 : 6);
    }

    if (dashboardMiniMapMarker) {
        dashboardMiniMapMarker.setMap(null);
    }

    dashboardMiniMapMarker = new google.maps.Marker({
        position: center,
        map: dashboardMiniMap,
        title: location.label || 'Map preview location',
    });

    if (location.source === 'browser') {
        setText('mini-map-caption', 'Current location preview. Open the planner to build a route.');
        return;
    }

    if (location.source === 'cached') {
        setText('mini-map-caption', 'Last shared location preview. Use current location to refresh it.');
        return;
    }

    setText(
        'mini-map-caption',
        forced
            ? 'Browser location is unavailable. Check site permissions and try again.'
            : 'Allow browser location or use the button above to centre this map on your current position.'
    );
}

async function initMiniMap() {
    const mapElement = getElement('mini-map');
    if (!mapElement) {
        return;
    }

    mapElement.innerHTML = '';
    const location = await getPreferredMapLocation();
    await applyDashboardMapLocation(location);
}

async function forceDashboardLocation() {
    const button = getElement('dashboard-location-button');
    if (button) {
        button.disabled = true;
        button.textContent = 'Locating...';
    }

    try {
        const location = await getPreferredMapLocation({ allowCache: false });
        await applyDashboardMapLocation(location, { forced: true });
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = 'Use current location';
        }
    }
}

function loadGoogleMapsScript() {
    return new Promise((resolve, reject) => {
        if (window.google?.maps) {
            resolve();
            return;
        }

        const apiKey = getGoogleMapsBrowserApiKey();
        if (!apiKey) {
            reject(new Error('Google Maps browser API key is not configured.'));
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Could not load Google Maps API.'));
        document.head.appendChild(script);
    });
}

function renderDirectionsPreview(mapElement, directions, options = {}) {
    const map = new google.maps.Map(mapElement, {
        zoom: options.zoom || 6,
        center: { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
    });

    const directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: options.suppressMarkers ?? true,
        polylineOptions: {
            strokeColor: '#3A5A40',
            strokeWeight: 4,
        },
    });

    directionsRenderer.setMap(map);
    directionsRenderer.setDirections(directions);
    return map;
}

function createFavoriteCard(favorite) {
    const card = document.createElement('a');
    card.href = `/route-details?favoriteId=${encodeURIComponent(favorite.id)}`;
    card.className = 'favorite-card';

    const mapWrapper = document.createElement('div');
    mapWrapper.className = 'favorite-card__map';

    const badge = createTextElement('span', 'Saved route', 'favorite-card__badge');
    const miniMap = document.createElement('div');
    const miniMapId = `mini-map-fav-${favorite.id}`;
    miniMap.id = miniMapId;
    miniMap.className = 'favorite-mini-map';

    mapWrapper.append(badge, miniMap);

    const body = document.createElement('div');
    body.className = 'favorite-card__body';
    body.appendChild(createTextElement('h3', favorite.name || 'Saved itinerary'));

    const summary = getFavoriteSummary(favorite);
    body.appendChild(createTextElement('p', `${summary.firstStop} → ${summary.lastStop}`));
    body.appendChild(createMetaList([
        `${summary.stops} stops`,
        summary.days > 0 ? `${summary.days} days` : null,
        summary.legs > 0 ? `${summary.legs} route legs` : 'Map route',
        summary.updatedAt,
    ]));

    card.append(mapWrapper, body);
    return { card, miniMapId };
}

function renderFavoriteFallback(favorite, container) {
    const card = document.createElement('a');
    card.href = `/route-details?favoriteId=${encodeURIComponent(favorite.id)}`;
    card.className = 'favorite-card favorite-card--fallback';

    const body = document.createElement('div');
    body.className = 'favorite-card__body';

    const summary = getFavoriteSummary(favorite);
    body.appendChild(createTextElement('h3', favorite.name || 'Saved itinerary'));
    body.appendChild(createTextElement('p', `${summary.firstStop} → ${summary.lastStop}`));
    body.appendChild(createMetaList([
        `${summary.stops} stops`,
        summary.days > 0 ? `${summary.days} days` : null,
        'Open details',
        summary.updatedAt,
    ]));

    card.appendChild(body);
    container.appendChild(card);
}

function initMiniMapForFavorite(favorite, elementId) {
    const mapElement = getElement(elementId);
    if (!mapElement) {
        return;
    }

    try {
        const favoriteMap = renderDirectionsPreview(mapElement, favorite.map_data);
        favoriteMap.addListener('click', () => {
            window.location.href = `/route-details?favoriteId=${encodeURIComponent(favorite.id)}`;
        });
    } catch (error) {
        const card = mapElement.closest('.favorite-card');
        if (card) {
            const container = getElement('favorites-container');
            card.remove();
            renderFavoriteFallback(favorite, container);
        }
    }
}

function updateFavoritesMeta(favorites) {
    const count = Array.isArray(favorites) ? favorites.length : 0;
    setDashboardMetric('favorite-count', String(count));
    setText('favorites-meta', count === 1 ? '1 saved route' : `${count} saved routes`);
}

async function loadFavorites() {
    const favoritesContainer = getElement('favorites-container');
    if (!favoritesContainer) {
        return;
    }

    favoritesContainer.innerHTML = '';
    favoritesContainer.setAttribute('aria-busy', 'true');

    try {
        const favoritesArray = await apiGet('/favorites');
        favoritesContainer.removeAttribute('aria-busy');
        updateFavoritesMeta(favoritesArray);

        const savedRoutesSection = getElement('dashboard-saved-routes-section');
        if (!Array.isArray(favoritesArray) || favoritesArray.length === 0) {
            savedRoutesSection?.classList.add('is-hidden');
            favoritesContainer.innerHTML = '';
            return favoritesArray;
        }

        savedRoutesSection?.classList.remove('is-hidden');

        favoritesArray.forEach((favorite) => {
            if (!favorite.map_data?.routes) {
                renderFavoriteFallback(favorite, favoritesContainer);
                return;
            }

            const { card, miniMapId } = createFavoriteCard(favorite);
            favoritesContainer.appendChild(card);
            initMiniMapForFavorite(favorite, miniMapId);
        });

        return favoritesArray;
    } catch (error) {
        favoritesContainer.removeAttribute('aria-busy');
        setDashboardMetric('favorite-count', '—');
        setText('favorites-meta', 'Could not load');
        replaceWithState(
            favoritesContainer,
            'Could not load saved routes',
            'Please refresh the page or sign in again.'
        );
        return [];
    }
}

function renderRecentSummary(recentSearch) {
    const container = getElement('recent-summary');
    if (!container) {
        return;
    }

    const monuments = Array.isArray(recentSearch?.monuments) ? recentSearch.monuments : [];
    const routeSummary = getRouteSummary(recentSearch?.directions, monuments);
    const query = recentSearch?.query_params || {};
    const cities = Array.isArray(query.selectedCities) ? query.selectedCities.join(', ') : '';

    const card = document.createElement('div');
    card.className = 'summary-card';

    card.appendChild(createTextElement('h3', cities || 'Recent route'));
    card.appendChild(createTextElement('p', `${routeSummary.firstStop} → ${routeSummary.lastStop}`));

    const meta = document.createElement('div');
    meta.className = 'summary-meta';
    [
        `${monuments.length} stops`,
        getItineraryDays(recentSearch?.itinerary) > 0 ? `${getItineraryDays(recentSearch.itinerary)} days` : null,
        routeSummary.legCount > 0 ? `${routeSummary.legCount} legs` : 'Route saved',
        formatDisplayDate(recentSearch?.updated_at || recentSearch?.created_at),
    ].forEach((item) => {
        if (item) {
            meta.appendChild(createTextElement('span', item));
        }
    });

    card.appendChild(meta);
    container.replaceChildren(card);
}

async function loadRecentSearch() {
    const recentMapContainer = getElement('recent-map');
    const recentSummary = getElement('recent-summary');
    if (!recentSummary) {
        return null;
    }

    try {
        const recentSearch = await apiGet('/recent_search');
        const recentSection = getElement('recent-route-section');
        if (!recentSearch?.directions?.routes) {
            if (recentMapContainer) {
                recentMapContainer.classList.add('is-hidden');
            }
            recentSection?.classList.add('is-hidden');
            setDashboardMetric('recent-route-state', 'Empty');
            recentSummary.innerHTML = '';
            return null;
        }

        recentSection?.classList.remove('is-hidden');

        setDashboardMetric('recent-route-state', 'Ready');
        if (recentMapContainer) {
            recentMapContainer.classList.remove('is-hidden');
            recentMapContainer.innerHTML = '';
            renderDirectionsPreview(recentMapContainer, recentSearch.directions);
        }
        renderRecentSummary(recentSearch);

        const openRecentRoute = () => {
            localStorage.setItem('recentSearch', JSON.stringify(recentSearch));
            window.location.href = '/plan-trip?recent=true';
        };

        recentMapContainer?.addEventListener('click', openRecentRoute);
        recentMapContainer?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openRecentRoute();
            }
        });

        return recentSearch;
    } catch (error) {
        if (recentMapContainer) {
            recentMapContainer.classList.add('is-hidden');
        }
        getElement('recent-route-section')?.classList.add('is-hidden');
        setDashboardMetric('recent-route-state', 'Empty');
        recentSummary.innerHTML = '';
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    setupLogoutButton();
    getElement('dashboard-location-button')?.addEventListener('click', forceDashboardLocation);

    let user;
    try {
        user = await updateUserNameAndImage();
        updateOnboardingState(user);
    } catch (error) {
        window.location.href = '/login';
        return;
    }

    try {
        await loadGoogleMapsScript();
        setDashboardMetric('maps-state', 'Ready');
        await initMiniMap();
        const [favorites, recentSearch] = await Promise.all([loadFavorites(), loadRecentSearch()]);
        updateOnboardingState(user, favorites, recentSearch);
    } catch (error) {
        setMapUnavailableState('The interactive map is temporarily unavailable. Your saved routes are still available as cards and lists.');
        updateOnboardingState(user);
    }
});
