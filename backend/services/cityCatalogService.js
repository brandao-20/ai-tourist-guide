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

function getCountryName(countryCode) {
  if (!displayNames) {
    return countryCode;
  }

  return displayNames.of(countryCode) || countryCode;
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

module.exports = {
  getCountryName,
  listCountries,
  listCitiesByCountry,
  normalizeCountryCode,
};
