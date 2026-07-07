const attractions = require('../data/attractions.json');

const MAX_DAYS = 14;
const MAX_STOPS = 24;
const DEFAULT_COUNTRY_CODE = 'PT';
const DEFAULT_CITY = 'Lisbon';

const INTENT_TAGS = [
  { pattern: /historic|history|old town|castle|monument|heritage|cultural|culture/i, tag: 'historic', label: 'history and culture' },
  { pattern: /view|viewpoint|miradouro|sunset|photo|scenic/i, tag: 'viewpoint', label: 'viewpoints' },
  { pattern: /food|lunch|dinner|restaurant|coffee|cafe|café|gastronomy|local/i, tag: 'food', label: 'food and local experiences' },
  { pattern: /walk|walkable|walking|stroll|pedestrian/i, tag: 'walking', label: 'walkable route' },
  { pattern: /beach|coast|sea|ocean|relax|relaxed/i, tag: 'beach', label: 'relaxed coastal stops' },
  { pattern: /museum|art|gallery|indoor/i, tag: 'museum', label: 'museums and indoor culture' },
  { pattern: /architecture|palace|cathedral|church|building/i, tag: 'architecture', label: 'architecture' },
  { pattern: /family|kids|children/i, tag: 'family', label: 'family-friendly rhythm' },
  { pattern: /romantic|couple|date/i, tag: 'romantic', label: 'romantic route' },
  { pattern: /nature|park|garden|green/i, tag: 'garden', label: 'green spaces' },
];

const CATEGORY_ALIASES = new Map([
  ['museums', ['museums', 'museum', 'art galleries']],
  ['parks', ['parks', 'garden', 'botanical gardens']],
  ['stadiums', ['stadiums', 'sports facilities']],
  ['monuments', ['monuments', 'architectural landmarks', 'castle']],
  ['beaches', ['beaches', 'beach']],
  ['art galleries', ['art galleries', 'museums', 'art']],
  ['religious sites', ['religious sites', 'cathedral', 'church']],
  ['viewpoints', ['viewpoints', 'viewpoint', 'scenic']],
  ['markets', ['markets', 'food', 'local experiences']],
  ['local experiences', ['local experiences', 'food', 'walking']],
  ['historic neighborhoods', ['historic neighborhoods', 'historic', 'walking']],
  ['architectural landmarks', ['architectural landmarks', 'architecture', 'monuments']],
]);

const DEFAULT_PREFERENCES = {
  travelPace: 'balanced',
  budget: 'flexible',
  transportMode: 'driving',
  walkingTolerance: 'medium',
  favoriteInterests: [],
  notes: '',
};

function normalizeText(value, maxLength = 180) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
    : '';
}

function normalizeLookup(value) {
  return normalizeText(value, 180)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : [];
}

function normalizePreferences(preferences = {}) {
  if (!preferences || typeof preferences !== 'object') {
    return { ...DEFAULT_PREFERENCES };
  }

  return {
    travelPace: normalizeText(preferences.travelPace) || DEFAULT_PREFERENCES.travelPace,
    budget: normalizeText(preferences.budget) || DEFAULT_PREFERENCES.budget,
    transportMode: normalizeText(preferences.transportMode) || DEFAULT_PREFERENCES.transportMode,
    walkingTolerance: normalizeText(preferences.walkingTolerance) || DEFAULT_PREFERENCES.walkingTolerance,
    favoriteInterests: normalizeArray(preferences.favoriteInterests).slice(0, 10),
    notes: normalizeText(preferences.notes, 240),
  };
}

function getTripDays(selectedDays) {
  const rawValue = Array.isArray(selectedDays) ? selectedDays[0] : selectedDays;
  const days = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(days) || days < 1) {
    return 3;
  }
  return Math.min(days, MAX_DAYS);
}

function getSelectedCountries(input) {
  const countries = normalizeArray(input.selectedCountries);
  return countries.length > 0 ? countries : [DEFAULT_COUNTRY_CODE];
}

function getSelectedCities(input) {
  const cities = normalizeArray(input.selectedCities);
  return cities.length > 0 ? cities : [DEFAULT_CITY];
}

function expandCategory(category) {
  const normalized = normalizeLookup(category);
  const aliases = CATEGORY_ALIASES.get(normalized) || [normalized];
  return aliases.map(normalizeLookup);
}

function parseIntent(generalQuery = '', preferences = {}) {
  const text = `${generalQuery} ${preferences.notes || ''}`;
  const tags = [];
  const labels = [];

  INTENT_TAGS.forEach((intent) => {
    if (intent.pattern.test(text)) {
      tags.push(intent.tag);
      labels.push(intent.label);
    }
  });

  normalizeArray(preferences.favoriteInterests).forEach((interest) => {
    expandCategory(interest).forEach((tag) => tags.push(tag));
    labels.push(interest);
  });

  return {
    tags: [...new Set(tags)],
    labels: [...new Set(labels)].slice(0, 6),
  };
}

function getCandidateAttractions({ selectedCountries, selectedCities }) {
  const countrySet = new Set(selectedCountries.map(normalizeLookup));
  const citySet = new Set(selectedCities.map(normalizeLookup));

  return attractions.filter((attraction) => {
    const countryMatches = countrySet.size === 0 || countrySet.has(normalizeLookup(attraction.countryCode));
    const cityMatches = citySet.size === 0 || citySet.has(normalizeLookup(attraction.city));
    return countryMatches && cityMatches;
  });
}

function scoreAttraction(attraction, context) {
  const selectedCategoryAliases = context.selectedAttractions.flatMap(expandCategory);
  const attractionTokens = [
    attraction.category,
    ...(Array.isArray(attraction.tags) ? attraction.tags : []),
    attraction.name,
    attraction.description,
  ].map(normalizeLookup);

  const hasToken = (token) => attractionTokens.some((candidate) => candidate.includes(token) || token.includes(candidate));
  let score = Number(attraction.popularity) || 50;
  const reasons = [];

  selectedCategoryAliases.forEach((category) => {
    if (category && hasToken(category)) {
      score += 18;
      reasons.push(`matches ${category}`);
    }
  });

  context.intent.tags.forEach((tag) => {
    if (hasToken(tag)) {
      score += 14;
      reasons.push(`fits ${tag}`);
    }
  });

  if (context.preferences.travelPace === 'relaxed' && Number(attraction.durationMinutes) <= 75) {
    score += 6;
    reasons.push('keeps a relaxed pace');
  }

  if (context.preferences.walkingTolerance === 'high' && hasToken('walking')) {
    score += 6;
    reasons.push('works well on foot');
  }

  if (context.preferences.transportMode === 'walking' && hasToken('central')) {
    score += 5;
    reasons.push('is easy to combine in a compact route');
  }

  return {
    ...attraction,
    score,
    reason: reasons.length > 0
      ? `Selected because it ${reasons.slice(0, 2).join(' and ')}.`
      : 'Selected as a high-value stop for the chosen city.',
  };
}

function diversifyByCategory(scoredAttractions) {
  const selected = [];
  const categoryCount = new Map();

  scoredAttractions.forEach((attraction) => {
    const category = attraction.category || 'Other';
    const count = categoryCount.get(category) || 0;
    if (count >= 3 && selected.length > 5) {
      return;
    }
    categoryCount.set(category, count + 1);
    selected.push(attraction);
  });

  return selected;
}

function selectStops(input, preferences) {
  const selectedCountries = getSelectedCountries(input);
  const selectedCities = getSelectedCities(input);
  const selectedAttractions = normalizeArray(input.selectedAttractions);
  const days = getTripDays(input.selectedDays);
  const intent = parseIntent(input.generalQuery, preferences);
  const context = { selectedAttractions, intent, preferences };
  const candidates = getCandidateAttractions({ selectedCountries, selectedCities });
  const scored = candidates
    .map((attraction) => scoreAttraction(attraction, context))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const desiredStops = Math.min(MAX_STOPS, Math.max(3, days * (preferences.travelPace === 'fast' ? 4 : 3)));
  const diversified = diversifyByCategory(scored).slice(0, desiredStops);

  if (diversified.length > 0) {
    return diversified;
  }

  return selectedCities.slice(0, days).map((city, index) => ({
    city,
    countryCode: selectedCountries[0] || DEFAULT_COUNTRY_CODE,
    name: `${city} historic centre`,
    address: `${city}, Portugal`,
    category: 'Historic Neighborhoods',
    tags: ['historic', 'walking', 'local'],
    durationMinutes: 90,
    popularity: 65 - index,
    coordinates: null,
    description: `Fallback city-centre route anchor for ${city}.`,
    score: 60,
    reason: 'Selected as a safe fallback city-centre stop.',
  }));
}

function getLeastLoadedDayIndex(grouped, candidateIndexes) {
  const availableCandidates = candidateIndexes.filter((candidateIndex) => grouped[candidateIndex].stops.length < 4);
  const effectiveCandidates = availableCandidates.length > 0 ? availableCandidates : candidateIndexes;

  return effectiveCandidates.reduce((bestIndex, candidateIndex) => (
    grouped[candidateIndex].stops.length < grouped[bestIndex].stops.length ? candidateIndex : bestIndex
  ), effectiveCandidates[0]);
}

function groupStopsByDay(stops, days, selectedCities) {
  const grouped = Array.from({ length: days }, (_, index) => ({
    day: index + 1,
    city: selectedCities[index % selectedCities.length] || DEFAULT_CITY,
    stops: [],
  }));

  stops.forEach((stop, index) => {
    const matchingDayIndexes = grouped
      .map((day, dayIndex) => ({ day, dayIndex }))
      .filter(({ day }) => normalizeLookup(day.city) === normalizeLookup(stop.city))
      .map(({ dayIndex }) => dayIndex);

    const candidateIndexes = matchingDayIndexes.length > 0
      ? matchingDayIndexes
      : grouped.map((_, dayIndex) => dayIndex);

    const fallbackIndex = index % days;
    const targetIndex = candidateIndexes.length > 0
      ? getLeastLoadedDayIndex(grouped, candidateIndexes)
      : fallbackIndex;

    grouped[targetIndex].stops.push(stop);
  });

  return grouped;
}

function formatActivity(stop, order) {
  const prefixByOrder = ['Start at', 'Continue to', 'Add', 'Finish with'];
  const prefix = prefixByOrder[Math.min(order, prefixByOrder.length - 1)];
  return `${prefix} ${stop.name} (${stop.address}) — ${stop.reason}`;
}

function buildItinerary(dayGroups) {
  return dayGroups.map((group) => ({
    day: group.day,
    city: group.city,
    activities: group.stops.slice(0, 4).map(formatActivity),
  })).filter((day) => day.activities.length > 0);
}

function toMonument(stop) {
  return {
    name: stop.name,
    address: stop.address,
    city: stop.city,
    category: stop.category,
    tags: stop.tags || [],
    durationMinutes: stop.durationMinutes || null,
    reason: stop.reason,
    coordinates: stop.coordinates || null,
  };
}

function buildSummary({ days, selectedCities, intent, stops, preferences }) {
  const intentText = intent.labels.length > 0 ? intent.labels.join(', ') : 'balanced sightseeing';
  return {
    title: `${selectedCities.slice(0, 2).join(' → ')} ${days}-day route`,
    focus: intentText,
    pace: preferences.travelPace,
    transportMode: preferences.transportMode,
    stopCount: stops.length,
  };
}

function generateRecommendationPlan(input, rawPreferences = {}) {
  const preferences = normalizePreferences(rawPreferences);
  const selectedCities = getSelectedCities(input);
  const days = getTripDays(input.selectedDays);
  const intent = parseIntent(input.generalQuery, preferences);
  const stops = selectStops(input, preferences);
  const dayGroups = groupStopsByDay(stops, days, selectedCities);
  const itinerary = buildItinerary(dayGroups);
  const monuments = stops.map(toMonument);

  return {
    itinerary,
    monuments,
    recommendation: {
      engine: 'local-scoring-v1',
      summary: buildSummary({ days, selectedCities, intent, stops, preferences }),
      preferences,
      signals: {
        query: normalizeText(input.generalQuery, 500),
        intentTags: intent.tags,
        selectedCities,
        selectedAttractions: normalizeArray(input.selectedAttractions),
      },
      scores: stops.map((stop) => ({
        name: stop.name,
        city: stop.city,
        category: stop.category,
        score: Math.round(stop.score),
        reason: stop.reason,
      })),
    },
  };
}

module.exports = {
  DEFAULT_PREFERENCES,
  generateRecommendationPlan,
  normalizePreferences,
};
