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
      inset: 0;
      overflow: auto;
      background: rgba(25, 45, 34, 0.42);
      backdrop-filter: blur(8px);
    }
    .modal-content {
      position: relative;
      width: min(520px, calc(100% - 40px));
      margin: 12vh auto;
      padding: 28px;
      border: 1px solid rgba(52, 78, 65, 0.14);
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 30px 90px rgba(25, 45, 34, 0.22);
      color: #344e41;
    }
    .modal-content h2 {
      margin: 0 36px 14px 0;
      letter-spacing: -0.03em;
    }
    .close-button {
      position: absolute;
      top: 18px;
      right: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      color: #667367;
      font-size: 28px;
      font-weight: 900;
      cursor: pointer;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .close-button:hover,
    .close-button:focus {
      background: rgba(52, 78, 65, 0.08);
      color: #24382e;
      text-decoration: none;
    }
    #add-monument-input {
      width: 100%;
      min-height: 48px;
      padding: 0 14px;
      margin-top: 8px;
      border: 1px solid rgba(52, 78, 65, 0.16);
      border-radius: 14px;
      background: #f8faf5;
      color: #24382e;
      font: inherit;
      outline: none;
      box-sizing: border-box;
    }
    #add-monument-input:focus {
      border-color: rgba(52, 78, 65, 0.44);
      background: #ffffff;
      box-shadow: 0 0 0 4px rgba(52, 78, 65, 0.1);
    }
    .autocomplete-suggestions {
      display: grid;
      gap: 6px;
      list-style-type: none;
      padding: 8px;
      margin: 8px 0 0;
      max-height: 220px;
      overflow-y: auto;
      border: 1px solid rgba(52, 78, 65, 0.12);
      border-radius: 16px;
      background-color: #ffffff;
      box-shadow: 0 16px 40px rgba(25, 45, 34, 0.12);
    }
    .autocomplete-suggestions:empty {
      display: none;
    }
    .autocomplete-suggestions li {
      padding: 11px 12px;
      border-radius: 12px;
      color: #344e41;
      cursor: pointer;
      line-height: 1.4;
    }
    .autocomplete-suggestions li:hover {
      background-color: rgba(52, 78, 65, 0.08);
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
      <h2>Add custom stop</h2>
      <input id="add-monument-input" type="text" placeholder="Search for a place or attraction..." autocomplete="off" />
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
        notify.warning('This stop has already been added.');
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
