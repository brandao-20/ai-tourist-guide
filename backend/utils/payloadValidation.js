const MAX_SEARCH_TEXT_LENGTH = 500;
const MAX_SEARCH_ITEMS = 30;
const MAX_SEARCH_ITEM_LENGTH = 120;
const MIN_TRIP_DAYS = 1;
const MAX_TRIP_DAYS = 30;
const MAX_FAVORITE_NAME_LENGTH = 120;
const MAX_STORED_JSON_BYTES = 1_500_000;

function parsePositiveIntegerParam(value) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isJsonContainer(value) {
  return value !== null && typeof value === 'object';
}

function getJsonPayloadSize(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch (error) {
    return Number.POSITIVE_INFINITY;
  }
}

function validateStoredJsonPayload(value, fieldName, options = {}) {
  const {
    allowNull = false,
    requirePlainObject = false,
    maxBytes = MAX_STORED_JSON_BYTES,
  } = options;

  if (value === undefined || value === null) {
    if (allowNull) {
      return { value: null };
    }

    return { error: `${fieldName} is required.` };
  }

  if (requirePlainObject ? !isPlainObject(value) : !isJsonContainer(value)) {
    return { error: `${fieldName} must be a valid JSON object or array.` };
  }

  if (getJsonPayloadSize(value) > maxBytes) {
    return { error: `${fieldName} is too large.` };
  }

  return { value };
}

function normalizeText(value, maxLength = MAX_SEARCH_ITEM_LENGTH) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
    : '';
}

function normalizeStringArray(value, fieldName) {
  if (!Array.isArray(value)) {
    return { error: `${fieldName} must be a valid list.` };
  }

  const normalized = [];
  const seen = new Set();

  value.slice(0, MAX_SEARCH_ITEMS).forEach((item) => {
    const normalizedItem = normalizeText(item, MAX_SEARCH_ITEM_LENGTH);
    const dedupeKey = normalizedItem.toLowerCase();

    if (normalizedItem && !seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      normalized.push(normalizedItem);
    }
  });

  if (normalized.length === 0) {
    return { error: `${fieldName} must include at least one valid value.` };
  }

  return { value: normalized };
}

function normalizeSearchDays(value) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const days = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(days) || days < MIN_TRIP_DAYS || days > MAX_TRIP_DAYS) {
    return { error: `selectedDays must be between ${MIN_TRIP_DAYS} and ${MAX_TRIP_DAYS}.` };
  }

  return { value: [String(days)] };
}

function normalizeSearchPayload(body = {}) {
  const generalQuery = normalizeText(body.generalQuery, MAX_SEARCH_TEXT_LENGTH);

  if (!generalQuery) {
    return { error: 'generalQuery is required.' };
  }

  const selectedCountries = normalizeStringArray(body.selectedCountries, 'selectedCountries');
  const selectedCities = normalizeStringArray(body.selectedCities, 'selectedCities');
  const selectedAttractions = normalizeStringArray(body.selectedAttractions, 'selectedAttractions');
  const selectedDays = normalizeSearchDays(body.selectedDays);
  const firstError = selectedCountries.error ||
    selectedCities.error ||
    selectedAttractions.error ||
    selectedDays.error;

  if (firstError) {
    return { error: firstError };
  }

  return {
    value: {
      generalQuery,
      selectedCountries: selectedCountries.value,
      selectedCities: selectedCities.value,
      selectedAttractions: selectedAttractions.value,
      selectedDays: selectedDays.value,
    },
  };
}

function normalizeFavoritePayload(body = {}) {
  const name = normalizeText(body.name, MAX_FAVORITE_NAME_LENGTH) || 'Untitled itinerary';
  const itinerary = validateStoredJsonPayload(body.itinerary, 'itinerary', {
    requirePlainObject: true,
  });
  const mapData = validateStoredJsonPayload(body.map_data, 'map_data', {
    requirePlainObject: true,
  });
  const firstError = itinerary.error || mapData.error;

  if (firstError) {
    return { error: firstError };
  }

  return {
    value: {
      name,
      itinerary: itinerary.value,
      map_data: mapData.value,
    },
  };
}

function normalizeRecentSearchPayload(body = {}) {
  const queryParams = validateStoredJsonPayload(body.query_params, 'query_params', {
    requirePlainObject: true,
  });
  const itinerary = validateStoredJsonPayload(body.itinerary, 'itinerary', {
    allowNull: true,
  });
  const monuments = validateStoredJsonPayload(body.monuments, 'monuments', {
    allowNull: true,
  });
  const directions = validateStoredJsonPayload(body.directions, 'directions', {
    allowNull: true,
  });
  const firstError = queryParams.error || itinerary.error || monuments.error || directions.error;

  if (firstError) {
    return { error: firstError };
  }

  return {
    value: {
      query_params: queryParams.value,
      itinerary: itinerary.value,
      monuments: monuments.value,
      directions: directions.value,
    },
  };
}

module.exports = {
  parsePositiveIntegerParam,
  normalizeFavoritePayload,
  normalizeRecentSearchPayload,
  normalizeSearchPayload,
  validateStoredJsonPayload,
};
