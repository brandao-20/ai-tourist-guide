const db = require('../models');

function toPlainModel(model) {
  if (!model) {
    return null;
  }

  return typeof model.get === 'function' ? model.get({ plain: true }) : model;
}

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

async function createFavoriteItinerary(userId, favoritePayload) {
  const favorite = await db.FavoriteItinerary.create({
    user_id: userId,
    ...favoritePayload,
  });

  return serializeFavoriteItinerary(favorite);
}

async function listFavoriteItineraries(userId) {
  const favorites = await db.FavoriteItinerary.findAll({
    where: { user_id: userId },
    order: [['createdAt', 'DESC']],
  });

  return favorites.map(serializeFavoriteItinerary);
}

async function findFavoriteItinerary(userId, favoriteId) {
  const favorite = await db.FavoriteItinerary.findOne({
    where: { id: favoriteId, user_id: userId },
  });

  return serializeFavoriteItinerary(favorite);
}

async function deleteFavoriteItinerary(userId, favoriteId) {
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
  createFavoriteItinerary,
  listFavoriteItineraries,
  findFavoriteItinerary,
  deleteFavoriteItinerary,
  serializeFavoriteItinerary,
};
