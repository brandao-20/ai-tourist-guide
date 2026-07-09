const LABEL_BY_TYPE = {
  country: 'country',
  city: 'city',
  attraction: 'interests',
  day: 'duration',
};

const SUMMARY_BY_SELECTED_KEY = {
  countries: 'Country',
  cities: 'City',
  attractions: 'Interests',
  days: 'Duration',
};

const ATTRACTIONS = [
  'Museums',
  'Parks',
  'Stadiums',
  'Landmarks',
  'Beaches',
  'Art Galleries',
  'Zoos',
  'Aquariums',
  'Theaters',
  'Religious Sites',
  'Botanical Gardens',
  'Viewpoints',
  'Markets',
  'Local Experiences',
  'Sports Facilities',
  'Historic Neighborhoods',
  'Libraries',
  'Architectural Landmarks',
  'Casinos',
  'Wildlife Reserves',
  'Amusement Parks',
];

const SELECTED_SET_BY_TYPE = {
  country: 'countries',
  city: 'cities',
  attraction: 'attractions',
  day: 'days',
};

function escapeSelectorValue(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(String(value));
  }

  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function getDropdowns() {
  return {
    countries: document.getElementById('countries-list'),
    cities: document.getElementById('cities-list'),
    attractions: document.getElementById('attractions-list'),
    days: document.getElementById('days-list'),
  };
}

function getItemsContainer(dropdown, type) {
  if (!dropdown) {
    throw new Error(`Dropdown for ${type} not found.`);
  }

  const itemsContainer = dropdown.querySelector('.dropdown-items');
  if (!itemsContainer) {
    throw new Error(`Dropdown items container for ${type} not found.`);
  }

  return itemsContainer;
}

function getSummaryContainer() {
  return document.getElementById('selection-summary');
}

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown.open').forEach((dropdown) => {
    dropdown.classList.remove('open');
    const menu = dropdown.querySelector('.dropdown-menu');
    const toggle = dropdown.querySelector('.dropdown-toggle');
    menu?.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  });
}

function updateDropdownToggleLabel(dropdown, type, selectedSet) {
  const wrapper = dropdown?.closest('.dropdown');
  const toggle = wrapper?.querySelector('.dropdown-toggle');
  if (!toggle) {
    return;
  }

  const count = selectedSet?.size || 0;
  toggle.classList.toggle('has-selection', count > 0);

  if (type === 'day' && count > 0) {
    const selectedValue = Array.from(selectedSet)[0];
    toggle.textContent = selectedValue === '1' ? '1 day' : `${selectedValue} days`;
  } else if (count > 0) {
    const labels = getSelectedLabels(dropdown, selectedSet);
    const visible = labels.slice(0, 2).join(', ');
    const extra = labels.length > 2 ? ` +${labels.length - 2}` : '';
    toggle.textContent = `${visible}${extra}`;
  } else {
    toggle.textContent = `Choose ${LABEL_BY_TYPE[type]}`;
  }
  toggle.setAttribute('aria-expanded', dropdown.classList.contains('open') ? 'true' : 'false');
}

function getSelectedLabels(dropdown, selectedSet) {
  return Array.from(selectedSet).map((value) => {
    const item = dropdown?.querySelector(`[data-value="${escapeSelectorValue(value)}"]`);
    return item?.dataset.label || value;
  });
}

function createSelectionChip(label, value) {
  const chip = document.createElement('span');
  chip.className = 'selection-chip';

  const strong = document.createElement('strong');
  strong.textContent = label;

  const text = document.createElement('span');
  text.textContent = value;

  chip.append(strong, text);
  return chip;
}

function updateSelectionSummary(selected, dropdowns) {
  const summary = getSummaryContainer();
  if (!summary) {
    return;
  }

  summary.replaceChildren();

  const chips = [];
  Object.entries(selected).forEach(([selectedKey, selectedSet]) => {
    if (selectedSet.size === 0) {
      return;
    }

    const labels = getSelectedLabels(dropdowns[selectedKey], selectedSet);
    const value = labels.slice(0, 3).join(', ');
    const extra = labels.length > 3 ? ` +${labels.length - 3}` : '';
    chips.push(createSelectionChip(SUMMARY_BY_SELECTED_KEY[selectedKey], `${value}${extra}`));
  });

  if (chips.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'selection-summary__empty';
    empty.textContent = 'No trip details selected yet.';
    summary.appendChild(empty);
    return;
  }

  chips.forEach((chip) => summary.appendChild(chip));
}

function setupDropdownToggle(dropdown) {
  if (!dropdown || dropdown.dataset.toggleBound === 'true') {
    return;
  }

  const toggle = dropdown.querySelector('.dropdown-toggle');
  const menu = dropdown.querySelector('.dropdown-menu');
  if (!toggle || !menu) {
    return;
  }

  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    closeAllDropdowns();
    dropdown.classList.toggle('open', !isOpen);
    menu.classList.toggle('open', !isOpen);
    toggle.setAttribute('aria-expanded', String(!isOpen));
    if (!isOpen) {
      const searchInput = dropdown.querySelector('.dropdown-search');
      window.setTimeout(() => searchInput?.focus(), 0);
    }
  });

  dropdown.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  dropdown.dataset.toggleBound = 'true';
}

function setupDropdownSearch(dropdown) {
  if (!dropdown || dropdown.dataset.searchBound === 'true') {
    return;
  }

  const searchInput = dropdown.querySelector('.dropdown-search');
  const itemsContainer = dropdown.querySelector('.dropdown-items');
  if (!searchInput || !itemsContainer) {
    return;
  }

  searchInput.addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase();
    const items = itemsContainer.querySelectorAll('.dropdown-item:not(.no-results)');
    let hasVisibleItems = false;

    items.forEach((item) => {
      const matches = item.innerText.toLowerCase().includes(query);
      item.style.display = matches ? 'block' : 'none';
      hasVisibleItems = hasVisibleItems || matches;
    });

    let noResult = itemsContainer.querySelector('.no-results');
    if (!hasVisibleItems) {
      if (!noResult) {
        noResult = document.createElement('div');
        noResult.className = 'dropdown-item no-results';
        noResult.innerText = 'No results found.';
        itemsContainer.appendChild(noResult);
      }
      noResult.style.display = 'block';
      return;
    }

    if (noResult) {
      noResult.remove();
    }
  });

  searchInput.addEventListener('click', (event) => event.stopPropagation());
  itemsContainer.addEventListener('click', (event) => event.stopPropagation());
  dropdown.dataset.searchBound = 'true';
}

function setupOverallSearchAutoResize() {
  const overallSearch = document.querySelector('.overall-search');
  if (!overallSearch) {
    return;
  }

  function autoResizeTextarea() {
    this.style.height = 'auto';
    const computedStyle = window.getComputedStyle(this);
    const maxHeight = parseFloat(computedStyle.maxHeight);

    if (!Number.isFinite(maxHeight) || this.scrollHeight <= maxHeight) {
      this.style.height = `${this.scrollHeight}px`;
      this.style.overflowY = 'hidden';
      return;
    }

    this.style.height = `${maxHeight}px`;
    this.style.overflowY = 'auto';
  }

  overallSearch.addEventListener('input', autoResizeTextarea);
  autoResizeTextarea.call(overallSearch);
}

function sortByName(items) {
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export function createSearchFormController({ apiGet, notify }) {
  const dropdowns = getDropdowns();
  const selected = {
    countries: new Set(),
    cities: new Set(),
    attractions: new Set(),
    days: new Set(),
  };

  function refreshSummary() {
    updateSelectionSummary(selected, dropdowns);
  }

  function createDropdownItems(dropdown, items, type) {
    const itemsContainer = getItemsContainer(dropdown, type);
    const selectedKey = SELECTED_SET_BY_TYPE[type];

    items.forEach((item) => {
      if (itemsContainer.querySelector(`[data-value="${escapeSelectorValue(item.value)}"]`)) {
        return;
      }

      const option = document.createElement('div');
      option.className = 'dropdown-item';
      option.dataset.value = item.value;
      option.dataset.label = item.name;
      option.dataset.type = type;
      option.dataset.country = item.country || '';
      option.innerText = item.name;

      option.addEventListener('click', (event) => {
        event.stopPropagation();
        const selectedSet = selected[selectedKey];
        const wasSelected = option.classList.contains('selected');

        if (type === 'day') {
          itemsContainer.querySelectorAll('.dropdown-item.selected').forEach((selectedOption) => {
            selectedOption.classList.remove('selected');
          });
          selectedSet.clear();
        }

        const isSelected = type === 'day' ? !wasSelected : option.classList.toggle('selected');
        if (type === 'day') {
          option.classList.toggle('selected', isSelected);
        }

        if (isSelected) {
          selectedSet.add(item.value);
          if (type === 'country') {
            loadCitiesForCountry(item.value);
          }
          if (type === 'day') {
            closeAllDropdowns();
          }
        } else {
          selectedSet.delete(item.value);
          if (type === 'country') {
            removeCitiesOfCountry(item.value);
          }
        }

        updateDropdownToggleLabel(dropdown, type, selectedSet);
        refreshSummary();
      });

      itemsContainer.appendChild(option);
    });

    setupDropdownToggle(dropdown);
    setupDropdownSearch(dropdown);
    updateDropdownToggleLabel(dropdown, type, selected[selectedKey]);
    refreshSummary();
  }

  async function loadCountries() {
    try {
      const data = await apiGet('/cities/countries');
      if (!data || !Array.isArray(data.countries)) {
        throw new Error('Invalid countries response.');
      }

      const countries = sortByName(data.countries.map((country) => ({
        name: country.name || country.code,
        value: country.code,
      })));

      createDropdownItems(dropdowns.countries, countries, 'country');
    } catch (error) {
      notify.error('Error loading countries.');
    }
  }

  async function loadCitiesForCountry(countryCode) {
    if (!dropdowns.cities || dropdowns.cities.querySelector(`[data-country="${escapeSelectorValue(countryCode)}"]`)) {
      return;
    }

    try {
      const data = await apiGet('/cities', { params: { countryCode } });
      if (!data || !Array.isArray(data.cities)) {
        notify.error(`Invalid response for country ${countryCode}.`);
        return;
      }

      const cities = sortByName(data.cities.map((city) => ({
        name: city.name,
        value: city.name,
        country: countryCode,
      })));

      createDropdownItems(dropdowns.cities, cities, 'city');
    } catch (error) {
      notify.error(`Error loading cities for country ${countryCode}.`);
    }
  }

  function removeCitiesOfCountry(countryCode) {
    if (!dropdowns.cities) {
      return;
    }

    const cityOptions = Array.from(dropdowns.cities.querySelectorAll(`[data-country="${escapeSelectorValue(countryCode)}"]`));
    cityOptions.forEach((option) => {
      const cityValue = option.dataset.value;
      selected.cities.delete(cityValue);
      option.remove();
    });

    updateDropdownToggleLabel(dropdowns.cities, 'city', selected.cities);
    refreshSummary();
  }

  function loadAttractions() {
    const attractionItems = ATTRACTIONS.map((attraction) => ({
      name: attraction,
      value: attraction,
    }));
    createDropdownItems(dropdowns.attractions, attractionItems, 'attraction');
  }

  function loadDays() {
    const days = Array.from({ length: 14 }, (_, index) => {
      const value = String(index + 1);
      const label = index === 0 ? '1 day' : `${value} days`;
      return { name: label, value };
    });
    createDropdownItems(dropdowns.days, days, 'day');
  }

  function getPayload() {
    return {
      generalQuery: document.querySelector('.overall-search')?.value.trim() || '',
      selectedCountries: Array.from(selected.countries),
      selectedCities: Array.from(selected.cities),
      selectedAttractions: Array.from(selected.attractions),
      selectedDays: Array.from(selected.days),
    };
  }

  function validatePayload(payload) {
    const errors = [];
    // Notes are helpful but optional: selected filters are enough to create a route.
    if (payload.selectedCountries.length === 0) {
      errors.push('Please select at least one country.');
    }
    if (payload.selectedCities.length === 0) {
      errors.push('Please select at least one city.');
    }
    if (payload.selectedAttractions.length === 0) {
      errors.push('Please select at least one attraction.');
    }
    if (payload.selectedDays.length === 0) {
      errors.push('Please select the number of days.');
    }
    return errors;
  }

  function restoreQuery(recentSearch) {
    const overallSearch = document.querySelector('.overall-search');
    if (overallSearch && recentSearch?.query_params?.generalQuery) {
      overallSearch.value = recentSearch.query_params.generalQuery;
      overallSearch.dispatchEvent(new Event('input'));
    }
  }

  function setTravelRequest(value) {
    const overallSearch = document.querySelector('.overall-search');
    if (!overallSearch || !value) {
      return;
    }

    overallSearch.value = value;
    overallSearch.dispatchEvent(new Event('input'));
  }

  function applyPreset(preset) {
    const presets = {
      historic: 'historic city route with architecture, viewpoints and walkable old-town areas',
      food: 'local food route with markets, viewpoints, cultural stops and relaxed walking areas',
      relaxed: 'relaxed coastal route with beaches, viewpoints, gardens and easy food stops',
    };

    setTravelRequest(presets[preset] || 'balanced route with culture, food stops and scenic areas');
  }

  function applyPreferences(preferences = {}) {
    const interests = Array.isArray(preferences.favoriteInterests) && preferences.favoriteInterests.length > 0
      ? preferences.favoriteInterests.join(', ')
      : 'culture, viewpoints and local food';
    const pace = preferences.travelPace || 'balanced';
    const walking = preferences.walkingTolerance === 'high' ? 'walkable' : 'practical';
    setTravelRequest(`${pace} ${walking} route focused on ${interests}`);
  }

  function init() {
    document.addEventListener('click', closeAllDropdowns);
    loadCountries();
    loadAttractions();
    loadDays();
    setupOverallSearchAutoResize();
    refreshSummary();
  }

  return {
    init,
    getPayload,
    validatePayload,
    restoreQuery,
    applyPreset,
    applyPreferences,
  };
}
