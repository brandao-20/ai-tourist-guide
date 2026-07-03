console.log("Route Details Page Loaded");

// ==============================================
// Function to show the custom modal for favorite itinerary name
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

  // Save button: checks the input and calls the callback with the provided name
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

// Global variables
let map;
let directionsRenderer;
let directionsService;

// Variables for controlling the favorite status
let isFavorited = true;          // Route initially favorited
let favoriteRouteId = null;      // Store the favorite ID (for DELETE)
let currentRouteDetails = null;  // Store all route data (for refavoriting)

// 1) initMap
window.initMap = function () {
  try {
    map = new google.maps.Map(document.getElementById("map"), {
      zoom: 12,
      center: { lat: 38.7223, lng: -9.1393 },
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: "#FF0000",
        strokeWeight: 4,
      },
    });

    // Load the route details
    loadRouteDetails();

    // Attach event to the (un)favorite button
    const toggleFavoriteButton = document.getElementById("toggle-favorite-button");
    if (toggleFavoriteButton) {
      toggleFavoriteButton.addEventListener("click", toggleFavorite);
    }
  } catch (error) {
    console.error("Error initializing the map:", error);
  }
};

// 2) loadRouteDetails (makes GET /api/favorites/:routeId)
async function loadRouteDetails() {
  try {
    const params = new URLSearchParams(window.location.search);
    const routeId = params.get("favoriteId");

    if (!routeId) {
      console.error("Route ID not provided in URL.");
      return;
    }

    // Store the favorite ID (in case we need to delete later)
    favoriteRouteId = routeId;

    const response = await axios.get(getApiUrl(`/api/favorites/${routeId}`), {
      withCredentials: true,
    });

    const routeDetails = response.data;
    console.log("Route Details:", routeDetails);

    if (!routeDetails || Object.keys(routeDetails).length === 0) {
      console.error("No route details found for this ID.");
      return;
    }

    // Save the data in case the user unfavorites and wants to refavorite
    currentRouteDetails = routeDetails;

    displayRouteDetails(routeDetails);
  } catch (error) {
    console.error("Error fetching route details:", error);
  }
}

// 3) displayRouteDetails
function displayRouteDetails(routeDetails) {
  const { itinerary, map_data } = routeDetails;
  if (!itinerary || !itinerary.monuments || itinerary.monuments.length === 0) {
    console.error("Invalid itinerary data or no monuments.");
    return;
  }

  // Render markers on the map and the route
  renderMarkersAndRoute(itinerary.monuments, map_data);

  // Display the itinerary and the formatted monuments list
  displayCustomItinerary(itinerary, map_data);
}

// 4) renderMarkersAndRoute (same as before)
function renderMarkersAndRoute(monuments, mapData) {
  const bounds = new google.maps.LatLngBounds();

  monuments.forEach((monument) => {
    const { coordinates, name, address } = monument;
    if (coordinates && typeof coordinates.lat === "number" && typeof coordinates.lng === "number") {
      const position = { lat: coordinates.lat, lng: coordinates.lng };

      const marker = new google.maps.Marker({
        position,
        map,
        title: name,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `<h3>${name}</h3><p>${address}</p>`,
      });

      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });

      bounds.extend(position);
    }
  });

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds);
  }

  if (mapData && mapData.routes) {
    directionsRenderer.setDirections(mapData);
  }
}

// 5) displayCustomItinerary (same as before)
function displayCustomItinerary(itinerary, directionsResult) {
  let itineraryContainer = document.getElementById("custom-itinerary-container");
  if (!itineraryContainer) {
    const itineraryInfoDiv = document.querySelector(".itinerary-info");
    if (!itineraryInfoDiv) return;

    // Remove the old <pre> if it exists
    const oldPre = document.getElementById("itinerary-data");
    if (oldPre) oldPre.remove();

    itineraryContainer = document.createElement("div");
    itineraryContainer.id = "custom-itinerary-container";
    itineraryInfoDiv.appendChild(itineraryContainer);
  }

  itineraryContainer.innerHTML = "";

  if (directionsResult && directionsResult.routes && directionsResult.routes[0].legs) {
    const legs = directionsResult.routes[0].legs;

    const title = document.createElement("h2");
    title.textContent = "Itinerary";
    itineraryContainer.appendChild(title);

    legs.forEach((leg) => {
      const { start_address, end_address, distance, duration, steps } = leg;
      const legDiv = document.createElement("div");
      legDiv.className = "leg-item";
      legDiv.innerHTML = `
        <p><strong>${start_address}</strong> → <strong>${end_address}</strong></p>
        <p style="margin-left: 20px;">
          <em>Distance:</em> ${distance.text} 
          | <em>Duration:</em> ${duration.text}
        </p>
        <p style="margin-left: 20px;"><strong>Instructions:</strong></p>
      `;

      const stepsUl = document.createElement("ul");
      stepsUl.style.marginLeft = "40px";
      steps.forEach((step) => {
        const li = document.createElement("li");
        li.innerHTML = step.instructions;
        stepsUl.appendChild(li);
      });
      legDiv.appendChild(stepsUl);

      itineraryContainer.appendChild(legDiv);
    });
  }

  if (itinerary.monuments.length > 0) {
    const monumentsDiv = document.createElement("div");
    monumentsDiv.className = "monuments-container";

    const monumentsTitle = document.createElement("h2");
    monumentsTitle.textContent = "Monuments";
    monumentsDiv.appendChild(monumentsTitle);

    const ol = document.createElement("ol");
    itinerary.monuments.forEach((mon) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${mon.name}</strong> (${mon.address})`;
      ol.appendChild(li);
    });

    monumentsDiv.appendChild(ol);
    itineraryContainer.appendChild(monumentsDiv);
  }
}

// 6) toggleFavorite function - toggles between "Unfavorite" and "Favorite"
async function toggleFavorite() {
  const toggleFavoriteButton = document.getElementById("toggle-favorite-button");
  if (!toggleFavoriteButton) return;

  try {
    if (isFavorited) {
      // If it is favorited, unfavorite it (DELETE)
      const resp = await fetch(getApiUrl(`/api/favorites/${favoriteRouteId}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || "Error unfavoriting itinerary.");
      }

      console.log("Route unfavorited successfully:", data);

      // Update the state
      isFavorited = false;
      toggleFavoriteButton.textContent = "Favorite";

      alert("Route removed from favorites!");

    } else {
      // If it is not favorited, favorite it (POST)
      // Show the modal to request a name for the route
      showFavoriteNameModal(async function(favoriteName) {
        // Build the payload using the provided name and the saved data
        const payload = {
          name: favoriteName,
          itinerary: currentRouteDetails?.itinerary || {},
          map_data: currentRouteDetails?.map_data || {},
        };

        const resp = await fetch(getApiUrl('/api/favorites'), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data.error || "Error favoriting itinerary.");
        }

        console.log("Route favorited again successfully:", data);

        // Update the favorite ID
        favoriteRouteId = data.favoriteId;

        // Update the state
        isFavorited = true;
        toggleFavoriteButton.textContent = "Unfavorite";

        alert("Route added to favorites!");
      });
    }
  } catch (error) {
    console.error("Error in toggleFavorite:", error);
    alert(error.message || "An error occurred while toggling favorite.");
  }
}
