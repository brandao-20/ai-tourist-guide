const express = require('express');
const requireDbUser = require('../middleware/requireDbUser');
const {
  createFavoriteItinerary,
  listFavoriteItineraries,
  findFavoriteItinerary,
  deleteFavoriteItinerary,
} = require('../services/favoriteItineraryService');
const {
  sendJson,
  sendValidationError,
  sendNotFound,
  sendServerError,
} = require('../utils/httpResponses');
const {
  normalizeFavoritePayload,
  parsePositiveIntegerParam,
} = require('../utils/payloadValidation');

const router = express.Router();

router.use(requireDbUser);

router.post('/', async (req, res) => {
  try {
    const favoritePayload = normalizeFavoritePayload(req.body);
    if (favoritePayload.error) {
      return sendValidationError(res, favoritePayload.error);
    }

    const favorite = await createFavoriteItinerary(req.authenticatedUserId, favoritePayload.value);

    return sendJson(res, 201, {
      message: 'Favorite itinerary saved successfully.',
      favoriteId: favorite.id,
      favorite,
    });
  } catch (error) {
    return sendServerError(
      res,
      'Failed to save favorite itinerary',
      error,
      'Could not save favorite itinerary.'
    );
  }
});

router.get('/', async (req, res) => {
  try {
    const favorites = await listFavoriteItineraries(req.authenticatedUserId);
    return sendJson(res, 200, favorites);
  } catch (error) {
    return sendServerError(
      res,
      'Failed to list favorite itineraries',
      error,
      'Could not list favorite itineraries.'
    );
  }
});

router.get('/:id', async (req, res) => {
  try {
    const favoriteId = parsePositiveIntegerParam(req.params.id);
    if (!favoriteId) {
      return sendValidationError(res, 'Invalid favorite itinerary ID.');
    }

    const favorite = await findFavoriteItinerary(req.authenticatedUserId, favoriteId);
    if (!favorite) {
      return sendNotFound(res, 'Favorite itinerary not found.');
    }

    return sendJson(res, 200, favorite);
  } catch (error) {
    return sendServerError(
      res,
      'Failed to get favorite itinerary',
      error,
      'Could not get favorite itinerary.'
    );
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const favoriteId = parsePositiveIntegerParam(req.params.id);
    if (!favoriteId) {
      return sendValidationError(res, 'Invalid favorite itinerary ID.');
    }

    const deleted = await deleteFavoriteItinerary(req.authenticatedUserId, favoriteId);
    if (!deleted) {
      return sendNotFound(res, 'Favorite itinerary not found.');
    }

    return sendJson(res, 200, {
      message: 'Favorite itinerary removed successfully.',
      favoriteId,
    });
  } catch (error) {
    return sendServerError(
      res,
      'Failed to remove favorite itinerary',
      error,
      'Could not remove favorite itinerary.'
    );
  }
});

module.exports = router;
