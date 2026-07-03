// mainapp.js

import axios from 'axios';
import { getApiUrl } from './config.js';

// Variáveis globais
let lastItinerary = null;
let currentFavoriteId = null;        // Stores the favorited itinerary ID
let lastDirectionsResult = null;     // Stores the Google Directions response
let markers = [];                    // Markers on the map
let currentMonuments = [];           // Current itinerary monuments
let searchExecuted = false;          // Indicates if the Search button has been successfully executed

// Função de inicialização do mapa
window.initMap = function() {
  window.myMap = new google.maps.Map(document.getElementById("map"), {
    zoom: 6,
    center: { lat: 38.7223, lng: -9.1393 } // Lisbon
  });
  
  console.log("Google Maps initialized.");

  // Initialize the rest of the application after the map is ready
  initializeApp();
};

// ==============================================
// Função para exibir o modal customizado de nome para favorito
// ==============================================
function showFavoriteNameModal(callback) {
  // Check if the modal already exists; if not, create it
  let modal = document.getElementById("favoriteModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "favoriteModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content" style="text-align: center;">
        <span class="close-button" id="favoriteModalClose">&times;</span>
        <h2 style="color: #344e41;">Save Favorite Itinerary</h2>
        <input type="text" id="favoriteNameInput" placeholder="Enter a name for the itinerary" style="padding:10px; width:80%; border:1px solid #ccc; border-radius:4px; margin:10px 0;">
        <div>
          <button id="favoriteModalSave" style="background-color: #344e41; color:#fff; padding:10px 20px; border:none; border-radius:4px; cursor:pointer; margin-right:10px;">Save</button>
          <button id="favoriteModalCancel" style="background-color: #ff4d4d; color:#fff; padding:10px 20px; border:none; border-radius:4px; cursor:pointer;">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.style.display = "block";

  // Close the modal when clicking on the 'x'
  document.getElementById("favoriteModalClose").onclick = function () {
    modal.style.display = "none";
  };

  // The Cancel button also closes the modal
  document.getElementById("favoriteModalCancel").onclick = function () {
    modal.style.display = "none";
  };

  // Save button: verifies the input and calls the callback with the provided name
  document.getElementById("favoriteModalSave").onclick = function () {
    const inputVal = document.getElementById("favoriteNameInput").value;
    if (inputVal.trim() === "") {
      alert("Please enter a valid itinerary name.");
      return;
    }
    modal.style.display = "none";
    callback(inputVal.trim());
  };

  // Close the modal when clicking outside the content area
  window.onclick = function (event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };
}

// ==============================================
// Função principal de inicialização do app
// ==============================================
function initializeApp() {
  console.log("Initializing main application...");

  // Check if there is the parameter "recent=true" in the URL
  const urlParams = new URLSearchParams(window.location.search);
  const loadRecent = urlParams.get('recent');

  if (loadRecent === 'true') {
    const recentSearchData = localStorage.getItem('recentSearch');
    if (recentSearchData) {
      const recentSearch = JSON.parse(recentSearchData);
      console.log("Loading stored recent search:", recentSearch);
      
      // Fill in the overall search field
      document.querySelector(".overall-search").value = recentSearch.query_params.generalQuery;
      
      // If needed, mark the filters (countries, cities, etc.) according to the saved data
      // Example: recentSearch.query_params.selectedCountries.forEach(...)

      // Display the monuments and the itinerary, if available
      if (recentSearch.monuments) {
        displayMonumentsOnly(recentSearch.monuments);
      }
      if (recentSearch.directions && recentSearch.monuments) {
        displayItineraryAndMonuments(recentSearch.monuments, recentSearch.directions);
      }
    }
  }
  
  // Dropdown selectors
  const countriesDropdown = document.getElementById("countries-list");
  const citiesDropdown = document.getElementById("cities-list");
  const attractionsDropdown = document.getElementById("attractions-list");
  const daysDropdown = document.getElementById("days-list"); // New

  // Sets of selected items
  const selectedCountries = new Set();
  const selectedCities = new Set();
  const selectedAttractions = new Set();
  const selectedDays = new Set(); // New

  // Initialize DirectionsService and DirectionsRenderer
  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers: true, // Suppress default markers
    polylineOptions: {
      strokeColor: "#FF0000",
      strokeWeight: 4
    }
  });
  directionsRenderer.setMap(window.myMap);

  // ----------------------------------------------------------
  // Configure Toastr for notifications
  // ----------------------------------------------------------
  if (typeof window.toastr !== 'undefined') {
    window.toastr.options = {
      "closeButton": true,
      "debug": false,
      "newestOnTop": false,
      "progressBar": true,
      "positionClass": "toast-top-right",
      "preventDuplicates": true,
      "onclick": null,
      "showDuration": "300",
      "hideDuration": "1000",
      "timeOut": "5000",
      "extendedTimeOut": "1000",
      "showEasing": "swing",
      "hideEasing": "linear",
      "showMethod": "fadeIn",
      "hideMethod": "fadeOut"
    };
    console.log('Toastr configured:', window.toastr);
  } else {
    console.error("Toastr is not defined. Please ensure the Toastr library is loaded correctly.");
  }

  // ----------------------------------------------------------
  // Dynamic dropdowns
  // ----------------------------------------------------------
  const createDropdown = (dropdown, items, type) => {
    if (!dropdown) {
      console.error(`Dropdown for ${type} not found.`);
      return;
    }

    const itemsContainer = dropdown.querySelector(".dropdown-items");
    if (!itemsContainer) {
      console.error(`Items container for ${type} not found.`);
      return;
    }

    items.forEach((item) => {
      // Check if the item already exists
      if (itemsContainer.querySelector(`[data-value="${item.value}"]`)) return;

      const option = document.createElement("div");
      option.className = "dropdown-item";
      option.dataset.value = item.value;
      option.dataset.type = type;
      option.dataset.country = item.country || "";
      option.innerText = item.name;

      // Event to select/unselect the item
      option.addEventListener("click", (e) => {
        e.stopPropagation();
        const isSelected = option.classList.toggle("selected");
        if (type === "country") {
          if (isSelected) {
            selectedCountries.add(item.value);
            loadCitiesForCountry(item.value);
          } else {
            selectedCountries.delete(item.value);
            removeCitiesOfCountry(item.value);
          }
        } else if (type === "city") {
          if (isSelected) {
            selectedCities.add(item.value);
          } else {
            selectedCities.delete(item.value);
          }
        } else if (type === "attraction") {
          if (isSelected) {
            selectedAttractions.add(item.value);
          } else {
            selectedAttractions.delete(item.value);
          }
        } else if (type === "day") { // New
          if (isSelected) {
            selectedDays.add(item.value);
          } else {
            selectedDays.delete(item.value);
          }
        }

        console.log(`Updated Selections:`);
        console.log(`Selected Countries: ${Array.from(selectedCountries)}`);
        console.log(`Selected Cities: ${Array.from(selectedCities)}`);
        console.log(`Selected Attractions: ${Array.from(selectedAttractions)}`);
        console.log(`Selected Days: ${Array.from(selectedDays)}`);
      });

      itemsContainer.appendChild(option);
    });
  };

  // ----------------------------------------------------------
  // Load countries (restcountries)
  // ----------------------------------------------------------
  const loadCountries = async () => {
    try {
      const response = await axios.get("https://restcountries.com/v3.1/all");
      const countries = response.data.map((country) => ({
        name: country.name.common,
        value: country.cca2, // "PT", "FR", ...
      }));

      countries.sort((a, b) => a.name.localeCompare(b.name));

      createDropdown(countriesDropdown, countries, "country");
      addDropdownToggle(countriesDropdown);
      addDropdownSearch(countriesDropdown, "country");
    } catch (error) {
      console.error("Error loading countries:", error);
      if (window.toastr) {
        window.toastr.error("Error loading countries.");
      }
    }
  };


  // ----------------------------------------------------------
  // Load cities from the backend
  // ----------------------------------------------------------
  const loadCitiesForCountry = async (countryCode) => {
    if (citiesDropdown.querySelector(`[data-country="${countryCode}"]`)) {
      console.warn(`Cities for country ${countryCode} already loaded.`);
      return;
    }
    try {
      const response = await axios.get(getApiUrl(`/api/cities?countryCode=${countryCode}`));
      if (!response.data || !Array.isArray(response.data.cities)) {
        console.error(`Invalid response for country ${countryCode}.`);
        if (window.toastr) {
          window.toastr.error(`Invalid response for country ${countryCode}.`);
        }
        return;
      }

      const cities = response.data.cities.map((city) => ({
        name: city.name,
        value: city.name,
        country: countryCode
      }));

      cities.sort((a, b) => a.name.localeCompare(b.name));
      createDropdown(citiesDropdown, cities, "city");
      addDropdownToggle(citiesDropdown);
      addDropdownSearch(citiesDropdown, "city");
    } catch (error) {
      console.error(`Error loading cities for country ${countryCode}:`, error);
      if (window.toastr) {
        window.toastr.error(`Error loading cities for country ${countryCode}.`);
      }
    }
  };

  // ----------------------------------------------------------
  // Remove cities when unselecting a country
  // ----------------------------------------------------------
  const removeCitiesOfCountry = (countryCode) => {
    const cityOptions = Array.from(citiesDropdown.querySelectorAll(`[data-country="${countryCode}"]`));
    cityOptions.forEach((option) => {
      const cityValue = option.dataset.value;
      if (selectedCities.has(cityValue)) {
        selectedCities.delete(cityValue);
        option.classList.remove("selected");
      }
      option.remove();
    });
  };

  // ----------------------------------------------------------
  // Load attractions (static)
  // ----------------------------------------------------------
  const loadAttractions = () => {
    const attractions = [
      "Museums", "Parks", "Stadiums", "Monuments", "Beaches", "Art Galleries", "Zoos", "Aquariums",
      "Theaters", "Religious Sites", "Botanical Gardens", "Viewpoints", "Markets", "Local Experiences",
      "Sports Facilities", "Historic Neighborhoods", "Libraries", "Architectural Landmarks", "Casinos",
      "Wildlife Reserves", "Amusement Parks"

    ];
    const attractionItems = attractions.map((attraction) => ({
      name: attraction,
      value: attraction
    }));

    createDropdown(attractionsDropdown, attractionItems, "attraction");
    addDropdownToggle(attractionsDropdown);
    addDropdownSearch(attractionsDropdown, "attraction");
  };

  // ----------------------------------------------------------
  // Load days (new)
  // ----------------------------------------------------------
  const loadDays = () => {
    const days = [];
    for (let i = 1; i <= 30; i++) {
      days.push({ name: i.toString(), value: i.toString() });
    }
    createDropdown(daysDropdown, days, "day");
    addDropdownToggle(daysDropdown);
    addDropdownSearch(daysDropdown, "day");
  };

  // ----------------------------------------------------------
  // Search in dropdown
  // ----------------------------------------------------------
  const addDropdownSearch = (dropdown, type) => {
    if (!dropdown) return;
    const searchInput = dropdown.querySelector(".dropdown-search");
    const itemsContainer = dropdown.querySelector(".dropdown-items");
    if (!searchInput || !itemsContainer) return;

    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      const items = itemsContainer.querySelectorAll(".dropdown-item");
      let hasVisibleItems = false;
      items.forEach((item) => {
        const itemName = item.innerText.toLowerCase();
        if (itemName.includes(query)) {
          item.style.display = "block";
          hasVisibleItems = true;
        } else {
          item.style.display = "none";
        }
      });
      if (!hasVisibleItems) {
        if (!itemsContainer.querySelector(".no-results")) {
          const noResult = document.createElement("div");
          noResult.className = "dropdown-item no-results";
          noResult.innerText = "No results found.";
          itemsContainer.appendChild(noResult);
        }
      } else {
        const noResults = itemsContainer.querySelector(".no-results");
        if (noResults) {
          noResults.remove();
        }
      }
    });

    searchInput.addEventListener("click", (e) => e.stopPropagation());
    itemsContainer.addEventListener("click", (e) => e.stopPropagation());
  };

  // ----------------------------------------------------------
  // Toggle to open/close dropdown
  // ----------------------------------------------------------
  const addDropdownToggle = (dropdown) => {
    if (!dropdown) return;
    const toggle = dropdown.previousElementSibling;
    if (!toggle) return;

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllDropdowns();
      dropdown.classList.toggle("open");
    });

    const dropdownMenu = dropdown.querySelector(".dropdown-menu");
    if (dropdownMenu) {
      dropdownMenu.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }
  };

  // Close all dropdowns when clicking outside
  const closeAllDropdowns = () => {
    const allDropdownMenus = document.querySelectorAll(".dropdown-menu");
    allDropdownMenus.forEach((menu) => {
      menu.classList.remove("open");
    });
  };
  document.addEventListener("click", closeAllDropdowns);

  // ----------------------------------------------------------
  // Auto-resize the textarea
  // ----------------------------------------------------------
  const setupOverallSearchAutoResize = () => {
    const overallSearch = document.querySelector(".overall-search");
    if (!overallSearch) return;
    overallSearch.addEventListener("input", autoResizeTextarea);

    function autoResizeTextarea() {
      this.style.height = 'auto';
      const computedStyle = window.getComputedStyle(this);
      const maxHeight = parseFloat(computedStyle.maxHeight);
      if (this.scrollHeight <= maxHeight) {
        this.style.height = `${this.scrollHeight}px`;
        this.style.overflowY = 'hidden';
      } else {
        this.style.height = `${maxHeight}px`;
        this.style.overflowY = 'auto';
      }
    }
    autoResizeTextarea.call(overallSearch);
  };

  // ----------------------------------------------------------
  // Display only Monuments
  // ----------------------------------------------------------
  function displayMonumentsOnly(monuments) {
    currentMonuments = monuments;
    let monumentList = document.querySelector(".monument-list ol");
    if (!monumentList) {
      const searchSection = document.querySelector(".search-section");
      const monumentDiv = document.createElement("div");
      monumentDiv.className = "monument-list";
      monumentDiv.innerHTML = `<h2>Monuments to Visit:</h2><ol></ol>`;
      searchSection.appendChild(monumentDiv);
      monumentList = monumentDiv.querySelector("ol");
    }
    monumentList.innerHTML = "";

    currentMonuments.forEach((mon, index) => {
      const li = document.createElement("li");
      li.className = "monument-item";
      li.dataset.index = index;

      const monumentInfo = document.createElement("span");
      monumentInfo.textContent = `${mon.name} (${mon.address})`;

      const viewButton = document.createElement("button");
      viewButton.textContent = "View";
      viewButton.className = "view-button";
      viewButton.style.marginLeft = "10px";
      viewButton.addEventListener("click", () => {
        viewMonument(index);
      });

      const removeButton = document.createElement("button");
      removeButton.textContent = "Remove";
      removeButton.className = "remove-button";
      removeButton.style.marginLeft = "10px";
      removeButton.addEventListener("click", () => {
        removeMonument(index);
      });

      const moveUpButton = document.createElement("button");
      moveUpButton.textContent = "↑";
      moveUpButton.className = "move-up-button";
      moveUpButton.style.marginLeft = "5px";
      moveUpButton.addEventListener("click", () => {
        moveMonumentUp(index);
      });

      const moveDownButton = document.createElement("button");
      moveDownButton.textContent = "↓";
      moveDownButton.className = "move-down-button";
      moveDownButton.style.marginLeft = "5px";
      moveDownButton.addEventListener("click", () => {
        moveMonumentDown(index);
      });

      li.appendChild(monumentInfo);
      li.appendChild(viewButton);
      li.appendChild(removeButton);
      li.appendChild(moveUpButton);
      li.appendChild(moveDownButton);

      monumentList.appendChild(li);
    });

    plotMarkersOnMap(currentMonuments);
  }

  // ----------------------------------------------------------
  // Display Itinerary and Monuments (without Day header)
  // ----------------------------------------------------------
  function displayItineraryAndMonuments(monuments, directionsResult) {
    currentMonuments = monuments;

    // 1) Itinerary (legs)
    let itineraryContainer = document.getElementById("itinerary-ordered-list");
    if (!itineraryContainer) {
      const searchSection = document.querySelector(".search-section");
      const itineraryDiv = document.createElement("div");
      itineraryDiv.className = "itinerary-list";
      itineraryDiv.innerHTML = `<h2>Itinerary</h2><ol id="itinerary-ordered-list"></ol>`;
      searchSection.appendChild(itineraryDiv);
      itineraryContainer = itineraryDiv.querySelector("ol");
    }
    itineraryContainer.innerHTML = "";

    if (directionsResult.routes &&
        Array.isArray(directionsResult.routes) &&
        directionsResult.routes.length > 0 &&
        directionsResult.routes[0].legs) {
      const legs = directionsResult.routes[0].legs;
      legs.forEach((leg) => {
        const startLocation = leg.start_address;
        const endLocation   = leg.end_address;
        const distance      = leg.distance.text;
        const duration      = leg.duration.text;
        const steps         = leg.steps;

        const legDiv = document.createElement("div");
        legDiv.className = "leg-item";
        legDiv.innerHTML = `
          <p><strong>${startLocation}</strong> → <strong>${endLocation}</strong></p>
          <p style="margin-left: 20px;"><em>Distance:</em> ${distance} | <em>Duration:</em> ${duration}</p>
          <p style="margin-left: 20px;"><strong>Instructions:</strong></p>
          <ul style="margin-left: 40px;">
            ${steps.map(step => `<li>${step.instructions}</li>`).join('')}
          </ul>
        `;
        itineraryContainer.appendChild(legDiv);
      });
    } else {
      console.error("DirectionsResult does not contain legs.");
      if (window.toastr) {
        window.toastr.error("Failed to retrieve route segments.");
      }
    }

    // 2) List of Monuments
    let monumentList = document.querySelector(".monument-list ol");
    if (!monumentList) {
      const searchSection = document.querySelector(".search-section");
      const monumentDiv = document.createElement("div");
      monumentDiv.className = "monument-list";
      monumentDiv.innerHTML = `<h2>Monuments to Visit:</h2><ol></ol>`;
      searchSection.appendChild(monumentDiv);
      monumentList = monumentDiv.querySelector("ol");
    }
    monumentList.innerHTML = "";

    currentMonuments.forEach((mon, index) => {
      const li = document.createElement("li");
      li.className = "monument-item";
      li.dataset.index = index;

      const monumentInfo = document.createElement("span");
      monumentInfo.textContent = `${mon.name} (${mon.address})`;

      const viewButton = document.createElement("button");
      viewButton.textContent = "View";
      viewButton.className = "view-button";
      viewButton.style.marginLeft = "10px";
      viewButton.addEventListener("click", () => {
        viewMonument(index);
      });

      const removeButton = document.createElement("button");
      removeButton.textContent = "Remove";
      removeButton.className = "remove-button";
      removeButton.style.marginLeft = "10px";
      removeButton.addEventListener("click", () => {
        removeMonument(index);
      });

      const moveUpButton = document.createElement("button");
      moveUpButton.textContent = "↑";
      moveUpButton.className = "move-up-button";
      moveUpButton.style.marginLeft = "5px";
      moveUpButton.addEventListener("click", () => {
        moveMonumentUp(index);
      });

      const moveDownButton = document.createElement("button");
      moveDownButton.textContent = "↓";
      moveDownButton.className = "move-down-button";
      moveDownButton.style.marginLeft = "5px";
      moveDownButton.addEventListener("click", () => {
        moveMonumentDown(index);
      });

      li.appendChild(monumentInfo);
      li.appendChild(viewButton);
      li.appendChild(removeButton);
      li.appendChild(moveUpButton);
      li.appendChild(moveDownButton);

      monumentList.appendChild(li);
    });

    plotMarkersOnMap(currentMonuments);

    if (window.toastr) {
      window.toastr.success("Itinerary updated successfully!");
    }
  }

  // ----------------------------------------------------------
  // Remove, Move, View Monument
  // ----------------------------------------------------------
  function removeMonument(index) {
    const confirmation = confirm(`Are you sure you want to remove the monument "${currentMonuments[index].name}"?`);
    if (!confirmation) return;
    currentMonuments.splice(index, 1);
    displayMonumentsOnly(currentMonuments);
  }

  function moveMonumentUp(index) {
    if (index === 0) return;
    [currentMonuments[index - 1], currentMonuments[index]] =
      [currentMonuments[index], currentMonuments[index - 1]];
    displayMonumentsOnly(currentMonuments);
  }

  function moveMonumentDown(index) {
    if (index === currentMonuments.length - 1) return;
    [currentMonuments[index + 1], currentMonuments[index]] =
      [currentMonuments[index], currentMonuments[index + 1]];
    displayMonumentsOnly(currentMonuments);
  }

  function viewMonument(index) {
    if (!currentMonuments[index]) {
      console.error(`Monument at index ${index} not found.`);
      if (window.toastr) {
        window.toastr.error("Monument not found.");
      }
      return;
    }
    const monument = currentMonuments[index];
    if (!monument.coordinates) {
      console.error(`Coordinates for monument "${monument.name}" are not available.`);
      if (window.toastr) {
        window.toastr.error("Monument coordinates are not available.");
      }
      return;
    }
    const position = { lat: monument.coordinates.lat, lng: monument.coordinates.lng };
    window.myMap.setCenter(position);
    window.myMap.setZoom(15);
    if (markers[index] && markers[index].infoWindow) {
      markers[index].infoWindow.open(window.myMap, markers[index]);
    } else if (markers[index]) {
      const infoWindow = new google.maps.InfoWindow({
        content: `<h3>${monument.name}</h3><p>${monument.address}</p>`
      });
      infoWindow.open(window.myMap, markers[index]);
      markers[index].infoWindow = infoWindow;
    }
  }

  // ----------------------------------------------------------
  // Save Monuments and Generate Route (Directions)
  // ----------------------------------------------------------
  async function saveMonuments() {
    if (currentMonuments.length < 2) {
      if (window.toastr) {
        window.toastr.error("Please add at least two monuments to generate a route.");
      }
      return;
    }
    const travelModeSelect = document.getElementById("travel-mode");
    const selectedTravelMode = travelModeSelect.value; // "DRIVING", "WALKING", "BICYCLING"

    // Validation
    for (let mon of currentMonuments) {
      if (!mon.coordinates || typeof mon.coordinates.lat !== 'number' || typeof mon.coordinates.lng !== 'number') {
        if (window.toastr) {
          window.toastr.error(`Monument "${mon.name}" has invalid coordinates.`);
        }
        return;
      }
    }

    const waypoints = currentMonuments.slice(1, -1).map(mon => ({
      location: new google.maps.LatLng(mon.coordinates.lat, mon.coordinates.lng),
      stopover: true
    }));
    const origin = new google.maps.LatLng(currentMonuments[0].coordinates.lat, currentMonuments[0].coordinates.lng);
    const destination = new google.maps.LatLng(
      currentMonuments[currentMonuments.length - 1].coordinates.lat,
      currentMonuments[currentMonuments.length - 1].coordinates.lng
    );

    const request = {
      origin,
      destination,
      travelMode: google.maps.TravelMode[selectedTravelMode],
      waypoints,
      optimizeWaypoints: false
    };

    console.log("DirectionsRequest:", JSON.stringify(request, null, 2));

    try {
      const result = await directionsService.route(request);
      if (result.status === 'OK') {
        directionsRenderer.setDirections(result);
        displayItineraryAndMonuments(currentMonuments, result);
        // Store for possibly using when favoriting
        lastDirectionsResult = result;

        // After calculating the route, prepare and send data to save the recent search
        const payloadRecentSearch = {
          query_params: {
            generalQuery: document.querySelector(".overall-search").value.trim(),
            selectedCountries: Array.from(document.querySelectorAll(".dropdown-item.selected"))
                                  .filter(item => item.dataset.type === "country")
                                  .map(item => item.dataset.value),
            selectedCities: Array.from(document.querySelectorAll(".dropdown-item.selected"))
                                  .filter(item => item.dataset.type === "city")
                                  .map(item => item.dataset.value),
            selectedAttractions: Array.from(document.querySelectorAll(".dropdown-item.selected"))
                                  .filter(item => item.dataset.type === "attraction")
                                  .map(item => item.dataset.value),
            selectedDays: Array.from(document.querySelectorAll(".dropdown-item.selected"))
                                  .filter(item => item.dataset.type === "day")
                                  .map(item => item.dataset.value)
          },
          itinerary: lastItinerary,
          monuments: currentMonuments,
          directions: result
        };

        const backendURL = getApiUrl('').replace(/\/$/, '');
        const respRecent = await fetch(`${backendURL}/api/recent_search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payloadRecentSearch)
        });
        const recentData = await respRecent.json();
        if (respRecent.ok) {
          console.log("Recent search saved/updated successfully:", recentData);
          // Also save in localStorage to pass on to mainapp if invoked via home_logged
          localStorage.setItem('recentSearch', JSON.stringify(payloadRecentSearch));
        } else {
          console.error("Error saving recent search:", recentData.error);
        }
      } else {
        console.error("Error retrieving directions:", result.status);
        if (window.toastr) {
          window.toastr.error("Could not calculate the route. Please check the order of the monuments.");
        }
      }
    } catch (error) {
      console.error("Error requesting directions:", error);
      if (window.toastr) {
        window.toastr.error("An error occurred while calculating the route. Please try again.");
      }
    }
  }

  // ----------------------------------------------------------
  // Plot Markers on the Map
  // ----------------------------------------------------------
  function plotMarkersOnMap(monuments) {
    if (!window.myMap) {
      if (window.toastr) {
        window.toastr.error("Map not initialized.");
      }
      return;
    }
    // Remove previous markers
    markers.forEach(marker => {
      if (marker.infoWindow) marker.infoWindow.close();
      marker.setMap(null);
    });
    markers = [];

    const bounds = new google.maps.LatLngBounds();
    monuments.forEach(mon => {
      if (mon.coordinates && typeof mon.coordinates.lat === 'number' && typeof mon.coordinates.lng === 'number') {
        const position = { lat: mon.coordinates.lat, lng: mon.coordinates.lng };
        const marker = new google.maps.Marker({
          position,
          map: window.myMap,
          title: mon.name
        });
        const infoWindow = new google.maps.InfoWindow({
          content: `<h3>${mon.name}</h3><p>${mon.address}</p>`
        });
        marker.addListener('click', () => {
          infoWindow.open(window.myMap, marker);
        });
        marker.infoWindow = infoWindow;
        markers.push(marker);
        bounds.extend(position);
      } else {
        console.warn(`Monument "${mon.name}" does not have valid coordinates.`);
        if (window.toastr) {
          window.toastr.warning(`Monument "${mon.name}" does not have valid coordinates.`);
        }
      }
    });
    if (markers.length > 0) {
      window.myMap.fitBounds(bounds);
    }
  }

  // ----------------------------------------------------------
  // Modal for manually adding a Monument (Nominatim)
  // ----------------------------------------------------------
  function openAddMonumentModal() {
    console.log("Opening modal to add a monument...");
    let modal = document.getElementById("add-monument-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "add-monument-modal";
      modal.className = "modal";
      modal.innerHTML = `
        <div class="modal-content">
          <span class="close-button">&times;</span>
          <h2>Add Monument</h2>
          <input id="add-monument-input" type="text" placeholder="Enter the monument name..." autocomplete="off" />
          <ul id="autocomplete-suggestions" class="autocomplete-suggestions"></ul>
        </div>
      `;
      document.body.appendChild(modal);

      const style = document.createElement("style");
      style.type = "text/css";
      style.innerHTML = `
        .modal {
          display: none;
          position: fixed;
          z-index: 1001;
          left: 0; top: 0;
          width: 100%; height: 100%;
          overflow: auto;
          background-color: rgba(0,0,0,0.4);
        }
        .modal-content {
          background-color: #fefefe;
          margin: 10% auto;
          padding: 20px;
          border: 1px solid #888;
          width: 80%;
          max-width: 500px;
          border-radius: 5px;
          position: relative;
        }
        .close-button {
          color: #aaa;
          position: absolute;
          top: 10px; right: 15px;
          font-size: 28px; font-weight: bold;
          cursor: pointer;
        }
        .close-button:hover,
        .close-button:focus {
          color: black; text-decoration: none;
        }
        #add-monument-input {
          width: 100%; padding: 10px; margin-top: 10px;
          box-sizing: border-box; border: 1px solid #ccc;
          border-radius: 4px; font-size: 16px;
        }
        .autocomplete-suggestions {
          list-style-type: none; padding: 0; margin: 5px 0 0 0;
          max-height: 150px; overflow-y: auto;
          border: 1px solid #ccc; border-top: none;
          background-color: #fff; position: absolute;
          width: 100%; z-index: 1002;
        }
        .autocomplete-suggestions li {
          padding: 10px; cursor: pointer;
        }
        .autocomplete-suggestions li:hover {
          background-color: #f0f0f0;
        }
      `;
      document.head.appendChild(style);
    }

    modal.style.display = "block";
    const closeButton = modal.querySelector(".close-button");
    const addMonumentInput = modal.querySelector("#add-monument-input");
    const suggestionsList = modal.querySelector("#autocomplete-suggestions");

    addMonumentInput.value = "";
    suggestionsList.innerHTML = "";

    closeButton.onclick = () => { modal.style.display = "none"; };
    window.onclick = (event) => {
      if (event.target == modal) {
        modal.style.display = "none";
      }
    };

    addMonumentInput.addEventListener("input", debounce(async function() {
      const query = this.value.trim();
      if (query.length < 3) {
        suggestionsList.innerHTML = "";
        return;
      }
      try {
        console.log(`Fetching suggestions for: ${query}`);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        suggestionsList.innerHTML = "";

        if (data.length === 0) {
          const noResult = document.createElement("li");
          noResult.textContent = "No results found.";
          suggestionsList.appendChild(noResult);
          return;
        }

        data.forEach(place => {
          const suggestion = document.createElement("li");
          suggestion.textContent = place.display_name;
          suggestion.addEventListener("click", () => {
            addMonumentInput.value = place.display_name;
            suggestionsList.innerHTML = "";

            const newMonument = {
              name: place.display_name.split(',')[0],
              address: place.display_name,
              coordinates: {
                lat: parseFloat(place.lat),
                lng: parseFloat(place.lon)
              }
            };
            const duplicate = currentMonuments.find(
              mon => mon.name === newMonument.name && mon.address === newMonument.address
            );
            if (duplicate) {
              if (window.toastr) {
                window.toastr.warning("This monument has already been added.");
              }
              return;
            }
            currentMonuments.push(newMonument);
            displayMonumentsOnly(currentMonuments);
            modal.style.display = "none";
          });
          suggestionsList.appendChild(suggestion);
        });
      } catch (error) {
        console.error("Error fetching suggestions from Nominatim:", error);
        suggestionsList.innerHTML = "";
        if (window.toastr) {
          window.toastr.error("Error fetching suggestions. Please try again.");
        }
      }
    }, 300));

    function debounce(func, delay) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
      };
    }
  }

  // ----------------------------------------------------------
  // Search Button (ChatGPT)
  // ----------------------------------------------------------
  const searchButton = document.getElementById("search-button");
  if (searchButton) {
    searchButton.addEventListener("click", async () => {
      const generalQuery = document.querySelector(".overall-search").value.trim();
      const selectedCountriesArray = Array.from(document.querySelectorAll(".dropdown-item.selected"))
        .filter(item => item.dataset.type === "country")
        .map(item => item.dataset.value);

      const selectedCitiesArray = Array.from(document.querySelectorAll(".dropdown-item.selected"))
        .filter(item => item.dataset.type === "city")
        .map(item => item.dataset.value);

      const selectedAttractionsArray = Array.from(document.querySelectorAll(".dropdown-item.selected"))
        .filter(item => item.dataset.type === "attraction")
        .map(item => item.dataset.value);

      const selectedDaysArray = Array.from(document.querySelectorAll(".dropdown-item.selected"))
        .filter(item => item.dataset.type === "day")
        .map(item => item.dataset.value);

      let validationPassed = true;
      if (generalQuery === "") {
        if (window.toastr) window.toastr.error("Please fill in the search bar before searching.");
        validationPassed = false;
      }
      if (selectedCountriesArray.length === 0) {
        if (window.toastr) window.toastr.error("Please select at least one country.");
        validationPassed = false;
      }
      if (selectedCitiesArray.length === 0) {
        if (window.toastr) window.toastr.error("Please select at least one city.");
        validationPassed = false;
      }
      if (selectedAttractionsArray.length === 0) {
        if (window.toastr) window.toastr.error("Please select at least one attraction.");
        validationPassed = false;
      }
      if (selectedDaysArray.length === 0) {
        if (window.toastr) window.toastr.error("Please select the number of days.");
        validationPassed = false;
      }
      if (!validationPassed) return;

      const payload = {
        generalQuery,
        selectedCountries: selectedCountriesArray,
        selectedCities: selectedCitiesArray,
        selectedAttractions: selectedAttractionsArray,
        selectedDays: selectedDaysArray
      };

      console.log('Sending request to /api/search:', payload);
      showLoadingIndicator();

      try {
        const backendURL = getApiUrl('').replace(/\/$/, '');
        const response = await fetch(`${backendURL}/api/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        hideLoadingIndicator();

        if (result.error) {
          console.error("Backend response error:", result.error);
          if (window.toastr) {
            window.toastr.error("An error occurred while processing your search.");
          }
        } else {
          console.log("ChatGPT response:", result.chatResponse);
          lastItinerary = result.itinerary;   // Store for reference
          displayMonumentsOnly(result.monuments);

          // If there are "routes" in the response
          if (result.routes) {
            displayItineraryAndMonuments(result.monuments, result.routes);
          } else {
            console.warn('Property routes not found in the response.');
          }
          // Mark that the search was executed successfully
          searchExecuted = true;
        }
      } catch (error) {
        hideLoadingIndicator();
        console.error("Error sending the request:", error);
        if (window.toastr) {
          window.toastr.error("An error occurred while sending your search.");
        }
      }
    });
  } else {
    console.error("Search button not found.");
    if (window.toastr) {
      window.toastr.error("Search button not found.");
    }
  }

  // ----------------------------------------------------------
  // Save Button (Generate the route)
  // ----------------------------------------------------------
  const saveButton = document.getElementById("save-button");
  if (saveButton) {
    saveButton.addEventListener("click", () => {
      saveMonuments();
    });
  }

  // ----------------------------------------------------------
  // Favorite / Unfavorite Buttons
  // ----------------------------------------------------------
  const favoriteButton = document.getElementById("favorite-button");
  const unfavoriteButton = document.getElementById("unfavorite-button");

  if (favoriteButton) {
    favoriteButton.addEventListener("click", async () => {
      // Check: only allow favoriting if the route has been saved (Save button pressed earlier)
      if (!lastDirectionsResult) {
        if (window.toastr) {
          window.toastr.error("Please save the route before marking it as favorite.");
        } else {
          alert("Please save the route before marking it as favorite.");
        }
        return;
      }
      
      // Show the custom modal for the user to enter the desired itinerary name
      showFavoriteNameModal(async function(favoriteName) {
        try {
          // Build the favorite object using the name provided by the user
          const payload = {
            name: favoriteName,
            itinerary: {
              days: lastItinerary,
              monuments: currentMonuments
            },
            map_data: lastDirectionsResult // Sending the complete object with the map data
          };
    
          const backendURL = getApiUrl('').replace(/\/$/, '');
          const resp = await fetch(`${backendURL}/api/favorites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // IMPORTANT to send session cookies
            body: JSON.stringify(payload)
          });
    
          const data = await resp.json(); 
          if (!resp.ok) {
            throw new Error(data.error || 'Error favoriting itinerary.');
          }
    
          console.log("Favorite created successfully:", data);
          currentFavoriteId = data.favoriteId;
    
          if (window.toastr) {
            window.toastr.success("Itinerary marked as favorite!");
          }
          
          // Adjust button visibility
          favoriteButton.style.display = "none";
          unfavoriteButton.style.display = "inline-block";
        } catch (error) {
          console.error("Error favoriting:", error);
          if (window.toastr) {
            window.toastr.error("Error marking itinerary as favorite.");
          }
        }
      });
    });
  }

  if (unfavoriteButton) {
    unfavoriteButton.addEventListener("click", async () => {
      try {
        if (!currentFavoriteId) {
          if (window.toastr) window.toastr.warning("This itinerary is not favorited or does not have a saved ID.");
          return;
        }
  
        const backendURL = getApiUrl('').replace(/\/$/, '');
        const resp = await fetch(`${backendURL}/api/favorites/${currentFavoriteId}`, {
          method: 'DELETE',
          credentials: 'include'    
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || 'Error removing from favorites.');
        }
  
        if (window.toastr) window.toastr.success("Itinerary removed from favorites!");
        currentFavoriteId = null;
  
        // Adjust button visibility
        favoriteButton.style.display = "inline-block";
        unfavoriteButton.style.display = "none";
  
      } catch (error) {
        console.error("Error unfavoriting:", error);
        if (window.toastr) {
          window.toastr.error("Error removing itinerary from favorites.");
        }
      }
    });
  }

  // ----------------------------------------------------------
  // "Add Monument" Button
  // ----------------------------------------------------------
  const addButton = document.getElementById("add-button");
  if (addButton) {
    addButton.addEventListener("click", () => {
      // Check: only allow adding a monument if a search has already been executed
      if (!searchExecuted) {
        if (window.toastr) {
          window.toastr.error("Please perform a search before adding a monument.");
        } else {
          alert("Please perform a search before adding a monument.");
        }
        return;
      }
      openAddMonumentModal();
    });
  }

  // ----------------------------------------------------------
  // Loader (show/hide)
  // ----------------------------------------------------------
  function showLoadingIndicator() {
    let loader = document.getElementById("loader");
    if (!loader) {
      loader = document.createElement("div");
      loader.id = "loader";
      loader.style.position = "fixed";
      loader.style.left = "50%";
      loader.style.top = "50%";
      loader.style.transform = "translate(-50%, -50%)";
      loader.style.border = "16px solid #f3f3f3";
      loader.style.borderTop = "16px solid #3498db";
      loader.style.borderRadius = "50%";
      loader.style.width = "120px";
      loader.style.height = "120px";
      loader.style.animation = "spin 2s linear infinite";
      document.body.appendChild(loader);

      const style = document.createElement("style");
      style.type = "text/css";
      style.innerHTML = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    loader.style.display = "block";
  }

  function hideLoadingIndicator() {
    const loader = document.getElementById("loader");
    if (loader) {
      loader.style.display = "none";
    }
  }

  // ----------------------------------------------------------
  // Initial loading
  // ----------------------------------------------------------
  loadCountries();
  loadAttractions();
  loadDays();
  setupOverallSearchAutoResize();
}
