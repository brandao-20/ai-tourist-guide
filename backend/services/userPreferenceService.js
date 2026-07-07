const VALID_PACES = ['relaxed', 'balanced', 'fast'];
const VALID_BUDGETS = ['low', 'medium', 'high', 'flexible'];
const VALID_TRANSPORT_MODES = ['walking', 'transit', 'driving', 'mixed'];
const VALID_WALKING_TOLERANCE = ['low', 'medium', 'high'];
const MAX_INTERESTS = 10;
const MAX_INTEREST_LENGTH = 80;
const MAX_NOTES_LENGTH = 240;

const DEFAULT_TRAVEL_PREFERENCES = {
  travelPace: 'balanced',
  budget: 'flexible',
  transportMode: 'driving',
  walkingTolerance: 'medium',
  favoriteInterests: [],
  notes: '',
};

function normalizeText(value, maxLength = MAX_INTEREST_LENGTH) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
    : '';
}

function normalizeEnum(value, validValues, fallback) {
  const normalized = normalizeText(value, 40).toLowerCase();
  return validValues.includes(normalized) ? normalized : fallback;
}

function normalizeFavoriteInterests(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];

  value.forEach((item) => {
    const interest = normalizeText(item, MAX_INTEREST_LENGTH);
    const key = interest.toLowerCase();
    if (interest && !seen.has(key)) {
      seen.add(key);
      normalized.push(interest);
    }
  });

  return normalized.slice(0, MAX_INTERESTS);
}

function normalizeTravelPreferences(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_TRAVEL_PREFERENCES };
  }

  return {
    travelPace: normalizeEnum(value.travelPace, VALID_PACES, DEFAULT_TRAVEL_PREFERENCES.travelPace),
    budget: normalizeEnum(value.budget, VALID_BUDGETS, DEFAULT_TRAVEL_PREFERENCES.budget),
    transportMode: normalizeEnum(value.transportMode, VALID_TRANSPORT_MODES, DEFAULT_TRAVEL_PREFERENCES.transportMode),
    walkingTolerance: normalizeEnum(
      value.walkingTolerance,
      VALID_WALKING_TOLERANCE,
      DEFAULT_TRAVEL_PREFERENCES.walkingTolerance
    ),
    favoriteInterests: normalizeFavoriteInterests(value.favoriteInterests),
    notes: normalizeText(value.notes, MAX_NOTES_LENGTH),
  };
}

module.exports = {
  DEFAULT_TRAVEL_PREFERENCES,
  normalizeTravelPreferences,
};
