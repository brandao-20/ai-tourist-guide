const { toPlainModel } = require('../utils/sequelizeHelpers');

let dbInstance;

function getDb() {
  if (!dbInstance) {
    dbInstance = require('../models');
  }
  return dbInstance;
}

const DEFAULT_FAVORITE_NAME = 'Untitled itinerary';
const MAX_SIGNATURE_STOPS = 25;
const COORDINATE_PRECISION = 5;

function serializeFavoriteItinerary(favorite) {
  const plainFavorite = toPlainModel(favorite);
  if (!plainFavorite) {
    return null;
  }

  return {
    id: plainFavorite.id,
    name: plainFavorite.name,
    itinerary: plainFavorite.itinerary,
    map_data: plainFavorite.map_data,
    createdAt: plainFavorite.createdAt,
    updatedAt: plainFavorite.updatedAt,
  };
}

function normalizeText(value) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').toLowerCase()
    : '';
}

function normalizeCoordinate(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toFixed(COORDINATE_PRECISION) : '';
}

function getStopSignature(stop) {
  if (typeof stop === 'string') {
    return normalizeText(stop);
  }

  if (!stop || typeof stop !== 'object') {
    return '';
  }

  const coordinateSignature = [
    normalizeCoordinate(stop.coordinates?.lat),
    normalizeCoordinate(stop.coordinates?.lng),
  ].filter(Boolean).join(',');

  const textSignature = [stop.name, stop.address, stop.city]
    .map(normalizeText)
    .filter(Boolean)
    .join('|');

  return coordinateSignature || textSignature;
}

function getStopsFromPayload(payload = {}) {
  const itinerary = payload.itinerary || {};
  if (Array.isArray(itinerary.monuments) && itinerary.monuments.length > 0) {
    return itinerary.monuments;
  }

  if (Array.isArray(payload.monuments) && payload.monuments.length > 0) {
    return payload.monuments;
  }

  const legs = payload.map_data?.routes?.[0]?.legs;
  if (!Array.isArray(legs) || legs.length === 0) {
    return [];
  }

  const routeStops = [];
  legs.forEach((leg, index) => {
    if (index === 0 && leg.start_address) {
      routeStops.push(leg.start_address);
    }
    if (leg.end_address) {
      routeStops.push(leg.end_address);
    }
  });

  return routeStops;
}

function buildRouteSignature(payload = {}) {
  const stopSignatures = getStopsFromPayload(payload)
    .slice(0, MAX_SIGNATURE_STOPS)
    .map(getStopSignature)
    .filter(Boolean);

  if (stopSignatures.length < 2) {
    return null;
  }

  return stopSignatures.join(' > ');
}

function extractCityFromAddress(address = '') {
  const parts = String(address)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }

  return parts[0] || '';
}

function getStopDisplayName(stop) {
  if (typeof stop === 'string') {
    return stop.split('(')[0].trim();
  }

  return stop?.name || '';
}

function getStopCity(stop) {
  if (typeof stop === 'string') {
    const match = stop.match(/\(([^)]*)\)/);
    return extractCityFromAddress(match?.[1] || stop);
  }

  return stop?.city || extractCityFromAddress(stop?.address || '');
}

function buildDefaultFavoriteName(favoritePayload) {
  const stops = getStopsFromPayload(favoritePayload);
  const cities = [];
  const seenCities = new Set();

  stops.forEach((stop) => {
    const city = getStopCity(stop);
    const normalizedCity = normalizeText(city);
    if (city && !seenCities.has(normalizedCity)) {
      seenCities.add(normalizedCity);
      cities.push(city);
    }
  });

  if (cities.length > 0) {
    return `${cities.slice(0, 2).join(' → ')} itinerary`;
  }

  const firstStop = getStopDisplayName(stops[0]);
  const lastStop = getStopDisplayName(stops[stops.length - 1]);
  if (firstStop && lastStop && firstStop !== lastStop) {
    return `${firstStop} → ${lastStop}`;
  }

  return DEFAULT_FAVORITE_NAME;
}

function withDisplayName(favoritePayload) {
  const name = normalizeText(favoritePayload.name) === normalizeText(DEFAULT_FAVORITE_NAME)
    ? buildDefaultFavoriteName(favoritePayload)
    : favoritePayload.name;

  return {
    ...favoritePayload,
    name: name || DEFAULT_FAVORITE_NAME,
  };
}

async function findMatchingFavorite(userId, favoritePayload) {
  const incomingSignature = buildRouteSignature(favoritePayload);
  if (!incomingSignature) {
    return null;
  }

  const db = getDb();
  const existingFavorites = await db.FavoriteItinerary.findAll({
    where: { user_id: userId },
    order: [['updatedAt', 'DESC']],
  });

  return existingFavorites.find((favorite) => {
    const plainFavorite = toPlainModel(favorite);
    const existingSignature = buildRouteSignature({
      itinerary: plainFavorite?.itinerary,
      map_data: plainFavorite?.map_data,
    });

    return existingSignature === incomingSignature;
  }) || null;
}

async function createOrUpdateFavoriteItinerary(userId, favoritePayload) {
  const normalizedPayload = withDisplayName(favoritePayload);
  const matchingFavorite = await findMatchingFavorite(userId, normalizedPayload);

  if (matchingFavorite) {
    await matchingFavorite.update(normalizedPayload);
    return {
      action: 'updated',
      favorite: serializeFavoriteItinerary(matchingFavorite),
    };
  }

  const db = getDb();
  const favorite = await db.FavoriteItinerary.create({
    user_id: userId,
    ...normalizedPayload,
  });

  return {
    action: 'created',
    favorite: serializeFavoriteItinerary(favorite),
  };
}


async function listFavoriteItineraries(userId) {
  const db = getDb();
  const favorites = await db.FavoriteItinerary.findAll({
    where: { user_id: userId },
    order: [['updatedAt', 'DESC']],
  });

  return favorites.map(serializeFavoriteItinerary);
}

async function findFavoriteItinerary(userId, favoriteId) {
  const db = getDb();
  const favorite = await db.FavoriteItinerary.findOne({
    where: { id: favoriteId, user_id: userId },
  });

  return serializeFavoriteItinerary(favorite);
}

async function updateFavoriteItineraryName(userId, favoriteId, name) {
  const db = getDb();
  const favorite = await db.FavoriteItinerary.findOne({
    where: { id: favoriteId, user_id: userId },
  });

  if (!favorite) {
    return null;
  }

  await favorite.update({ name });
  return serializeFavoriteItinerary(favorite);
}

async function deleteFavoriteItinerary(userId, favoriteId) {
  const db = getDb();
  const favorite = await db.FavoriteItinerary.findOne({
    where: { id: favoriteId, user_id: userId },
  });

  if (!favorite) {
    return false;
  }

  await favorite.destroy();
  return true;
}

module.exports = {
  buildRouteSignature,
  createOrUpdateFavoriteItinerary,
  listFavoriteItineraries,
  findFavoriteItinerary,
  updateFavoriteItineraryName,
  deleteFavoriteItinerary,
  serializeFavoriteItinerary,
};
