const MODAL_ID = 'add-monument-modal';
const MODAL_STYLE_ID = 'add-monument-modal-style';
const MIN_QUERY_LENGTH = 3;

function debounce(func, delay) {
  let timeout;
  return function debounced(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

function ensureModalStyle() {
  if (document.getElementById(MODAL_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = MODAL_STYLE_ID;
  style.type = 'text/css';
  style.innerHTML = `
    .modal {
      display: none;
      position: fixed;
      z-index: 1001;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      overflow: auto;
      background-color: rgba(0, 0, 0, 0.4);
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
      top: 10px;
      right: 15px;
      font-size: 28px;
      font-weight: bold;
      cursor: pointer;
    }
    .close-button:hover,
    .close-button:focus {
      color: black;
      text-decoration: none;
    }
    #add-monument-input {
      width: 100%;
      padding: 10px;
      margin-top: 10px;
      box-sizing: border-box;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 16px;
    }
    .autocomplete-suggestions {
      list-style-type: none;
      padding: 0;
      margin: 5px 0 0 0;
      max-height: 150px;
      overflow-y: auto;
      border: 1px solid #ccc;
      border-top: none;
      background-color: #fff;
      position: absolute;
      width: 100%;
      z-index: 1002;
    }
    .autocomplete-suggestions li {
      padding: 10px;
      cursor: pointer;
    }
    .autocomplete-suggestions li:hover {
      background-color: #f0f0f0;
    }
  `;
  document.head.appendChild(style);
}

function createModal() {
  ensureModalStyle();

  const modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-button" aria-label="Close">&times;</span>
      <h2>Add Monument</h2>
      <input id="add-monument-input" type="text" placeholder="Enter the monument name..." autocomplete="off" />
      <ul id="autocomplete-suggestions" class="autocomplete-suggestions"></ul>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function buildNominatimUrl(query) {
  const params = new URLSearchParams({
    format: 'json',
    limit: '5',
    q: query,
  });
  return `https://nominatim.openstreetmap.org/search?${params.toString()}`;
}

function hasDuplicateMonument(monuments, newMonument) {
  return monuments.some((monument) => (
    monument.name === newMonument.name && monument.address === newMonument.address
  ));
}

export function createManualMonumentController({ state, displayMonumentsOnly, notify }) {
  let modal;
  let input;
  let suggestionsList;
  let isBound = false;

  function closeModal() {
    modal.style.display = 'none';
  }

  function resetModal() {
    input.value = '';
    suggestionsList.innerHTML = '';
  }

  function addSuggestion(place) {
    const suggestion = document.createElement('li');
    suggestion.textContent = place.display_name;
    suggestion.addEventListener('click', () => {
      const newMonument = {
        name: place.display_name.split(',')[0],
        address: place.display_name,
        coordinates: {
          lat: Number.parseFloat(place.lat),
          lng: Number.parseFloat(place.lon),
        },
      };

      if (hasDuplicateMonument(state.currentMonuments, newMonument)) {
        notify.warning('This monument has already been added.');
        return;
      }

      state.currentMonuments.push(newMonument);
      displayMonumentsOnly(state.currentMonuments);
      closeModal();
    });
    suggestionsList.appendChild(suggestion);
  }

  async function searchSuggestions(query) {
    const response = await fetch(buildNominatimUrl(query));
    if (!response.ok) {
      throw new Error('Nominatim request failed.');
    }
    return response.json();
  }

  async function handleInput() {
    const query = input.value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      suggestionsList.innerHTML = '';
      return;
    }

    try {
      const data = await searchSuggestions(query);
      suggestionsList.innerHTML = '';

      if (!Array.isArray(data) || data.length === 0) {
        const noResult = document.createElement('li');
        noResult.textContent = 'No results found.';
        suggestionsList.appendChild(noResult);
        return;
      }

      data.forEach(addSuggestion);
    } catch (error) {
      suggestionsList.innerHTML = '';
      notify.error('Error fetching suggestions. Please try again.');
    }
  }

  function bindModalEvents() {
    if (isBound) {
      return;
    }

    modal.querySelector('.close-button').addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
    input.addEventListener('input', debounce(handleInput, 300));
    isBound = true;
  }

  function open() {
    modal = document.getElementById(MODAL_ID) || createModal();
    input = modal.querySelector('#add-monument-input');
    suggestionsList = modal.querySelector('#autocomplete-suggestions');
    bindModalEvents();
    resetModal();
    modal.style.display = 'block';
    input.focus();
  }

  return { open };
}
