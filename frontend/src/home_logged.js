import { apiGet } from './api.js';
import { getApiUrl, getUploadUrl, getGoogleMapsBrowserApiKey } from './config.js';

const DEFAULT_LOCATION = { lat: 38.7223, lng: -9.1393 };
const DEFAULT_AVATAR = 'default-avatar.svg';

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

function createStateCard(title, description, action) {
    const card = document.createElement('div');
    card.className = 'state-card';

    const heading = document.createElement('h3');
    heading.textContent = title;
    card.appendChild(heading);

    if (description) {
        const text = document.createElement('p');
        text.textContent = description;
        card.appendChild(text);
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

function replaceWithState(container, title, description, action) {
    if (!container) {
        return;
    }

    container.innerHTML = '';
    container.appendChild(createStateCard(title, description, action));
}

function setMapUnavailableState(message = 'Map preview unavailable.') {
    replaceWithState(
        getElement('mini-map'),
        'Explore map unavailable',
        message,
        { href: '/mainapp.html', label: 'Open trip planner' }
    );

    replaceWithState(
        getElement('recent-map'),
        'No map preview',
        'Recent routes can still be opened from the trip planner when available.',
        { href: '/mainapp.html', label: 'Open trip planner' }
    );

    replaceWithState(
        getElement('favorites-container'),
        'Favorite previews unavailable',
        'Saved routes are still available when Google Maps is configured.'
    );
}

async function updateUserNameAndImage() {
    const user = await apiGet('/user');
    const displayName = user.name || 'Traveller';

    setText('user-name', displayName);
    setImage(
        'profile-pic',
        user.profileImage ? getUploadUrl(user.profileImage) : DEFAULT_AVATAR,
        `${displayName} profile picture`
    );
}

function initMiniMap() {
    const mapElement = getElement('mini-map');
    if (!mapElement) {
        return;
    }

    const miniMap = new google.maps.Map(mapElement, {
        center: DEFAULT_LOCATION,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
    });

    const userMarker = new google.maps.Marker({
        position: DEFAULT_LOCATION,
        map: miniMap,
        title: 'You',
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                userMarker.setPosition(userPosition);
                miniMap.setCenter(userPosition);

                navigator.geolocation.watchPosition(
                    (positionUpdate) => {
                        const livePosition = {
                            lat: positionUpdate.coords.latitude,
                            lng: positionUpdate.coords.longitude,
                        };
                        userMarker.setPosition(livePosition);
                        miniMap.setCenter(livePosition);
                    },
                    () => {},
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                );
            },
            () => {},
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    }

    miniMap.addListener('click', () => {
        window.location.href = '/mainapp.html';
    });
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
        center: DEFAULT_LOCATION,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
    });

    const directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: '#FF0000',
            strokeWeight: 4,
        },
    });

    directionsRenderer.setMap(map);
    directionsRenderer.setDirections(directions);
    return map;
}

function renderFavoriteFallback(favorite, container) {
    const card = document.createElement('a');
    card.href = `/route_details.html?favoriteId=${encodeURIComponent(favorite.id)}`;
    card.className = 'favorite-card favorite-card--fallback';

    const title = document.createElement('h3');
    title.textContent = favorite.name || 'Saved itinerary';

    const description = document.createElement('p');
    description.textContent = 'Open this saved route to view its full details.';

    card.appendChild(title);
    card.appendChild(description);
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
            window.location.href = `/route_details.html?favoriteId=${encodeURIComponent(favorite.id)}`;
        });
    } catch (error) {
        const wrapper = mapElement.closest('.favorite-mini-map-wrapper');
        if (wrapper) {
            wrapper.remove();
            renderFavoriteFallback(favorite, getElement('favorites-container'));
        }
    }
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

        if (!Array.isArray(favoritesArray) || favoritesArray.length === 0) {
            replaceWithState(
                favoritesContainer,
                'No favorites yet',
                'Plan a route and save it to keep it here for quick access.',
                { href: '/mainapp.html', label: 'Plan a route' }
            );
            return;
        }

        favoritesArray.forEach((favorite) => {
            if (!favorite.map_data) {
                renderFavoriteFallback(favorite, favoritesContainer);
                return;
            }

            const favoriteWrapper = document.createElement('article');
            favoriteWrapper.className = 'favorite-mini-map-wrapper';

            const miniMapId = `mini-map-fav-${favorite.id}`;
            const miniMapDiv = document.createElement('div');
            miniMapDiv.id = miniMapId;
            miniMapDiv.className = 'favorite-mini-map';

            const favoriteName = document.createElement('p');
            favoriteName.className = 'favorite-name';
            favoriteName.textContent = favorite.name || 'Saved itinerary';

            favoriteWrapper.appendChild(miniMapDiv);
            favoriteWrapper.appendChild(favoriteName);
            favoritesContainer.appendChild(favoriteWrapper);
            initMiniMapForFavorite(favorite, miniMapId);
        });
    } catch (error) {
        favoritesContainer.removeAttribute('aria-busy');
        replaceWithState(
            favoritesContainer,
            'Could not load favorites',
            'Please refresh the page or sign in again.'
        );
    }
}

async function loadRecentSearch() {
    const recentMapContainer = getElement('recent-map');
    if (!recentMapContainer) {
        return;
    }

    try {
        const recentSearch = await apiGet('/recent_search');
        if (!recentSearch?.directions) {
            replaceWithState(
                recentMapContainer,
                'No recent route',
                'Your latest planned route will appear here.',
                { href: '/mainapp.html', label: 'Plan a route' }
            );
            return;
        }

        renderDirectionsPreview(recentMapContainer, recentSearch.directions);
        recentMapContainer.addEventListener('click', () => {
            localStorage.setItem('recentSearch', JSON.stringify(recentSearch));
            window.location.href = '/mainapp.html?recent=true';
        });
    } catch (error) {
        replaceWithState(
            recentMapContainer,
            'No recent route',
            'Your latest planned route will appear here.',
            { href: '/mainapp.html', label: 'Plan a route' }
        );
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const logoutButton = getElement('logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            window.location.href = getApiUrl('/logout');
        });
    }

    try {
        await updateUserNameAndImage();
    } catch (error) {
        window.location.href = '/login.html';
        return;
    }

    try {
        await loadGoogleMapsScript();
        initMiniMap();
        await Promise.all([loadFavorites(), loadRecentSearch()]);
    } catch (error) {
        setMapUnavailableState('Configure GOOGLE_MAPS_BROWSER_API_KEY to enable interactive route previews.');
    }
});
