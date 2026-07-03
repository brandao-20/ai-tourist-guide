const ATTRACTIONS = [
  'Museums',
  'Parks',
  'Stadiums',
  'Monuments',
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

  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\"');
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

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown-menu.open').forEach((menu) => {
    menu.classList.remove('open');
  });
}

function setupDropdownToggle(dropdown) {
  if (!dropdown || dropdown.dataset.toggleBound === 'true') {
    return;
  }

  const wrapper = dropdown.closest('.dropdown');
  const toggle = wrapper?.querySelector('.dropdown-toggle');
  if (!toggle) {
    return;
  }

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    closeAllDropdowns();
    dropdown.classList.toggle('open', !isOpen);
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
      option.dataset.type = type;
      option.dataset.country = item.country || '';
      option.innerText = item.name;

      option.addEventListener('click', (event) => {
        event.stopPropagation();
        const isSelected = option.classList.toggle('selected');
        const selectedSet = selected[selectedKey];

        if (isSelected) {
          selectedSet.add(item.value);
          if (type === 'country') {
            loadCitiesForCountry(item.value);
          }
          return;
        }

        selectedSet.delete(item.value);
        if (type === 'country') {
          removeCitiesOfCountry(item.value);
        }
      });

      itemsContainer.appendChild(option);
    });

    setupDropdownToggle(dropdown);
    setupDropdownSearch(dropdown);
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
  }

  function loadAttractions() {
    const attractionItems = ATTRACTIONS.map((attraction) => ({
      name: attraction,
      value: attraction,
    }));
    createDropdownItems(dropdowns.attractions, attractionItems, 'attraction');
  }

  function loadDays() {
    const days = Array.from({ length: 30 }, (_, index) => {
      const value = String(index + 1);
      return { name: value, value };
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
    if (!payload.generalQuery) {
      errors.push('Please fill in the search bar before searching.');
    }
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

  function init() {
    document.addEventListener('click', closeAllDropdowns);
    loadCountries();
    loadAttractions();
    loadDays();
    setupOverallSearchAutoResize();
  }

  return {
    init,
    getPayload,
    validatePayload,
    restoreQuery,
  };
}
