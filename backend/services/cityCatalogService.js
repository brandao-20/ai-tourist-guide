const fs = require('fs');
const path = require('path');
const { logServerError } = require('../utils/logger');

const citiesPath = path.resolve(__dirname, '..', 'data', 'cities.json');
const MAX_CITIES_PER_COUNTRY = 500;

function getRegionDisplayNames() {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch (error) {
    return null;
  }
}

function normalizeLookupText(value) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').toLowerCase()
    : '';
}

function normalizeCountryCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function normalizeCity(city) {
  const country = normalizeCountryCode(city?.country);
  const name = typeof city?.name === 'string' ? city.name.trim() : '';

  if (!country || !name) {
    return null;
  }

  return {
    id: city.id,
    name,
    latitude: Number(city.latitude),
    longitude: Number(city.longitude),
    country,
    population: Number.isFinite(Number(city.population)) ? Number(city.population) : 0,
  };
}

function loadCities() {
  try {
    const citiesFile = fs.readFileSync(citiesPath, 'utf8');
    const parsedCities = JSON.parse(citiesFile);

    if (!Array.isArray(parsedCities)) {
      throw new Error('cities.json must contain an array.');
    }

    return parsedCities.map(normalizeCity).filter(Boolean);
  } catch (error) {
    logServerError('Failed to load cities catalog', error);
    return [];
  }
}

const citiesData = loadCities();
const displayNames = getRegionDisplayNames();
const countryNameToCode = new Map();
const citiesByName = new Map();

function getCountryName(countryCode) {
  if (!displayNames) {
    return countryCode;
  }

  return displayNames.of(countryCode) || countryCode;
}

function indexCatalog() {
  const countryCodes = new Set(citiesData.map((city) => city.country));
  countryCodes.forEach((code) => {
    countryNameToCode.set(normalizeLookupText(getCountryName(code)), code);
    countryNameToCode.set(normalizeLookupText(code), code);
  });

  citiesData.forEach((city) => {
    const key = normalizeLookupText(city.name);
    if (!citiesByName.has(key)) {
      citiesByName.set(key, []);
    }
    citiesByName.get(key).push(city);
  });

  citiesByName.forEach((cities) => {
    cities.sort((a, b) => b.population - a.population);
  });
}

indexCatalog();

function resolveCountryCode(value) {
  const directCode = normalizeCountryCode(value);
  if (directCode.length === 2 && countryNameToCode.has(directCode.toLowerCase())) {
    return directCode;
  }

  return countryNameToCode.get(normalizeLookupText(value)) || '';
}

function listCountries() {
  const countryCodes = Array.from(new Set(citiesData.map((city) => city.country)));

  return countryCodes
    .map((code) => ({ code, name: getCountryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function listCitiesByCountry(countryCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    return [];
  }

  return citiesData
    .filter((city) => city.country === normalizedCountryCode)
    .sort((a, b) => {
      if (b.population !== a.population) {
        return b.population - a.population;
      }

      return a.name.localeCompare(b.name);
    })
    .slice(0, MAX_CITIES_PER_COUNTRY);
}

function findCityByName(cityName, countryCode = '') {
  const candidates = citiesByName.get(normalizeLookupText(cityName)) || [];
  const normalizedCountryCode = normalizeCountryCode(countryCode);

  if (normalizedCountryCode) {
    const countryMatch = candidates.find((city) => city.country === normalizedCountryCode);
    if (countryMatch) {
      return countryMatch;
    }
  }

  return candidates[0] || null;
}

module.exports = {
  findCityByName,
  getCountryName,
  listCountries,
  listCitiesByCountry,
  normalizeCountryCode,
  resolveCountryCode,
};
