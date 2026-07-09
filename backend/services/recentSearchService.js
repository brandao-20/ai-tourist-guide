const db = require('../models');
const { toPlainModel } = require('../utils/sequelizeHelpers');

function serializeRecentSearch(recentSearch) {
  const plainRecentSearch = toPlainModel(recentSearch);
  if (!plainRecentSearch) {
    return null;
  }

  return {
    id: plainRecentSearch.id,
    query_params: plainRecentSearch.query_params,
    itinerary: plainRecentSearch.itinerary,
    monuments: plainRecentSearch.monuments,
    directions: plainRecentSearch.directions,
    routeMetadata: plainRecentSearch.routeMetadata,
    created_at: plainRecentSearch.created_at,
    updated_at: plainRecentSearch.updated_at,
  };
}

async function upsertRecentSearch(userId, recentPayload) {
  const existingSearch = await db.RecentSearches.findOne({
    where: { user_id: userId },
  });

  if (existingSearch) {
    existingSearch.set(recentPayload);
    await existingSearch.save();
    return serializeRecentSearch(existingSearch);
  }

  const createdSearch = await db.RecentSearches.create({
    user_id: userId,
    ...recentPayload,
  });

  return serializeRecentSearch(createdSearch);
}

async function findLatestRecentSearch(userId) {
  const recentSearch = await db.RecentSearches.findOne({
    where: { user_id: userId },
    order: [['updated_at', 'DESC']],
  });

  return serializeRecentSearch(recentSearch);
}

module.exports = {
  upsertRecentSearch,
  findLatestRecentSearch,
  serializeRecentSearch,
};
