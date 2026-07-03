import axios from 'axios';
import { getApiUrl, getUploadUrl, getGoogleMapsBrowserApiKey } from './config.js';

document.addEventListener("DOMContentLoaded", () => {
    console.log("Home page loaded");


    let miniMap;
    let userMarker;


    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            // Redireciona para o endpoint de logout, que irá encerrar a sessão
            window.location.href = '/';
        });
    }

    // Function to update the user's name and profile image
    const updateUserNameAndImage = async () => {
        try {
            console.log("Requesting user data from /api/user");
            const response = await axios.get(getApiUrl('/api/user'), { withCredentials: true }); // Fetch user data with credentials
            const user = response.data;

            console.log('User data received:', user);

            // Update the user's name
            const userNameElement = document.getElementById('user-name');
            if (userNameElement) {
                userNameElement.textContent = user.name || 'Name not available';
                console.log('User name updated to:', user.name);
            } else {
                console.warn('Element with id "user-name" not found.');
            }

            // Update the user's profile picture
            const profilePicElement = document.getElementById('profile-pic');
            if (profilePicElement) {
                if (user.profileImage) {
                    profilePicElement.src = getUploadUrl(user.profileImage);
                } else {
                    profilePicElement.src = 'default-avatar.svg';
                }
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            window.location.href = '/login.html'; // Redirect to login page if user is not authenticated
        }
    };

    // Call the function to update user data
    updateUserNameAndImage();

    // Function to initialize the mini map on the home page (for Explore)
    function initMiniMap() {
        console.log("initMiniMap called");

        const initialLocation = { lat: 38.7223, lng: -9.1393 }; // Default location (e.g., Lisbon, Portugal)
        miniMap = new google.maps.Map(document.getElementById("mini-map"), {
            center: initialLocation,
            zoom: 14,
            mapTypeControl: false,       // Disable map type control
            streetViewControl: false,    // Disable street view control
            fullscreenControl: false     // Disable fullscreen control
        });

        userMarker = new google.maps.Marker({
            position: initialLocation,
            map: miniMap,
            title: "You"
        });

        // Use geolocation to update the user's real-time position
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userPosition = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    userMarker.setPosition(userPosition); // Set marker to user's current position
                    miniMap.setCenter(userPosition); // Center the map on the user's position

                    // Watch for position updates in real-time
                    navigator.geolocation.watchPosition(
                        (pos) => {
                            const livePos = {
                                lat: pos.coords.latitude,
                                lng: pos.coords.longitude
                            };
                            userMarker.setPosition(livePos);
                            miniMap.setCenter(livePos);
                        },
                        (err) => {
                            console.error("Error updating real-time position:", err);
                        },
                        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                    );
                },
                (error) => {
                    if (error.code === error.PERMISSION_DENIED) {
                        alert('Location access denied. The map will only show the initial position.');
                    } else {
                        console.error("Error getting initial location:", error);
                    }
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        } else {
            console.warn("Geolocation not supported in this browser.");
        }

        // Redirect to the main app page when the map is clicked
        miniMap.addListener("click", () => {
            window.location.href = '/mainapp.html';
        });
    }

    // Function to load the Google Maps script dynamically
    function loadGoogleMapsScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            
            const apiKey = getGoogleMapsBrowserApiKey();
            if (!apiKey) {
                reject(new Error('Google Maps browser API key is not configured.'));
                return;
            }
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                console.log("Google Maps API loaded successfully");
                resolve(); // Resolve the promise when the script is loaded
            };
            script.onerror = () => reject(new Error('Error loading Google Maps API'));
            document.head.appendChild(script);
        });
    }

    // Function to load favorites and display mini-maps along with their names
    async function loadFavorites() {
        try {
            const response = await axios.get(getApiUrl('/api/favorites'), {
                withCredentials: true
            });
            const favoritesArray = response.data; // array de favoritos

            console.log("Favorites received:", favoritesArray);

            const favoritesContainer = document.getElementById('favorites-container');
            if (!favoritesContainer) {
                console.warn("No favorites-container found in HTML.");
                return;
            }

            // Limpar antes de inserir
            favoritesContainer.innerHTML = '';

            // Para cada favorito, criar um div para o mini mapa e exibir o nome
            favoritesArray.forEach(fav => {
                // Cria um container para o favorito
                const favDiv = document.createElement('div');
                favDiv.className = 'favorite-mini-map-wrapper';
                favDiv.style.width = '100%';
                favDiv.style.height = '300px';
                favDiv.style.marginBottom = '20px';
                favDiv.style.position = 'relative';

                // Cria o contêiner para o mini-mapa
                const miniMapId = `mini-map-fav-${fav.id}`;
                const miniMapDiv = document.createElement('div');
                miniMapDiv.id = miniMapId;
                miniMapDiv.style.width = '100%';
                miniMapDiv.style.height = '100%';

                // Cria um elemento para exibir o nome do favorito
                const favName = document.createElement('p');
                favName.className = 'favorite-name';
                favName.textContent = fav.name || "Nome indisponível";
                // Estilizando o nome para sobrepor ao mini-mapa (você pode ajustar conforme preferir)
                favName.style.position = 'absolute';
                favName.style.bottom = '10px';
                favName.style.left = '10px';
                favName.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                favName.style.padding = '5px 10px';
                favName.style.borderRadius = '5px';
                favName.style.margin = '0';

                // Adiciona o mini-mapa e o nome ao container do favorito
                favDiv.appendChild(miniMapDiv);
                favDiv.appendChild(favName);
                favoritesContainer.appendChild(favDiv);

                // Inicializa o mini-mapa para o favorito
                initMiniMapForFavorite(fav, miniMapId);
            });
        } catch (error) {
            console.error("Error loading favorites:", error);
        }
    }

    // Function to initialize a mini-map for a favorite
    function initMiniMapForFavorite(fav, elementId) {
        const miniMapForFav = new google.maps.Map(document.getElementById(elementId), {
            zoom: 6,
            center: { lat: 38.7223, lng: -9.1393 }, // Default location
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false
        });

        const miniDirectionsRenderer = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            polylineOptions: {
                strokeColor: "#FF0000",
                strokeWeight: 4
            }
        });
        miniDirectionsRenderer.setMap(miniMapForFav);

        try {
            miniDirectionsRenderer.setDirections(fav.map_data);
        } catch (err) {
            console.error("Error setting directions for favorite ID:", fav.id, err);
        }

        // Redirect to route details page when clicked
        miniMapForFav.addListener("click", () => {
            window.location.href = `/route_details.html?favoriteId=${fav.id}`;
        });
    }

    // NEW: Function to load recent search data and display a mini-map in the "View Recently" section
    async function loadRecentSearch() {
        try {
            const response = await axios.get(getApiUrl('/api/recent_search'), { withCredentials: true });
            const recentSearch = response.data;
            console.log("Recent Search loaded:", recentSearch);

            // Verifica se há dados de direções para construir o mini mapa
            if (recentSearch && recentSearch.directions) {
                const recentMapContainer = document.getElementById('recent-map');
                if (!recentMapContainer) {
                    console.warn("No recent-map container found in HTML.");
                    return;
                }
                const recentMap = new google.maps.Map(recentMapContainer, {
                    zoom: 6,
                    center: { lat: 38.7223, lng: -9.1393 }, // Valor padrão; pode ser ajustado com base nos dados
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false
                });

                const recentDirectionsRenderer = new google.maps.DirectionsRenderer({
                    suppressMarkers: true,
                    polylineOptions: {
                        strokeColor: "#FF0000",
                        strokeWeight: 4
                    }
                });
                recentDirectionsRenderer.setMap(recentMap);
                try {
                    recentDirectionsRenderer.setDirections(recentSearch.directions);
                } catch (err) {
                    console.error("Error displaying directions on recent mini map:", err);
                }

                // Ao clicar no mini mapa, armazena os dados no localStorage e redireciona para mainapp.html?recent=true
                recentMapContainer.addEventListener("click", () => {
                    localStorage.setItem('recentSearch', JSON.stringify(recentSearch));
                    window.location.href = '/mainapp.html?recent=true';
                });
            }
        } catch (error) {
            console.error("Error loading recent search:", error);
        }
    }

    // Load the Google Maps script and initialize the maps
    loadGoogleMapsScript()
        .then(() => {
            initMiniMap();
            loadFavorites(); // Load favorites after maps script is loaded
            loadRecentSearch(); // Load recent search to display in View Recently
        })
        .catch((err) => {
            console.error('Error loading Google Maps API:', err);
        });

    // Add click event listeners to suggestion images
    const suggestions = document.querySelectorAll(".suggestions-grid img");
    suggestions.forEach((img, index) => {
        img.addEventListener("click", () => {
            alert(`You clicked on suggestion ${index + 1}`);
        });
    });
    
    // Add click event listeners to favorite images
    const favorites = document.querySelectorAll(".favorites-grid img");
    favorites.forEach((img, index) => {
        img.addEventListener("click", () => {
            alert(`You clicked on favorite ${index + 1}`);
        });
    });
});
