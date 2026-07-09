const express = require('express');
const requireDbUser = require('../middleware/requireDbUser');
const {
  upsertRecentSearch,
  findLatestRecentSearch,
} = require('../services/recentSearchService');
const {
  sendJson,
  sendValidationError,
  sendServerError,
} = require('../utils/httpResponses');
const { normalizeRecentSearchPayload } = require('../utils/payloadValidation');

const router = express.Router();

router.use(requireDbUser);

router.post('/', async (req, res) => {
  try {
    const recentPayload = normalizeRecentSearchPayload(req.body);
    if (recentPayload.error) {
      return sendValidationError(res, recentPayload.error);
    }

    const recentSearch = await upsertRecentSearch(req.authenticatedUserId, recentPayload.value);

    return sendJson(res, 200, {
      message: 'Recent search saved successfully.',
      recentSearchId: recentSearch.id,
      recentSearch,
    });
  } catch (error) {
    return sendServerError(
      res,
      'Failed to save recent search',
      error,
      'Could not save recent search.'
    );
  }
});

router.get('/', async (req, res) => {
  try {
    const recentSearch = await findLatestRecentSearch(req.authenticatedUserId);
    return sendJson(res, 200, recentSearch || null);
  } catch (error) {
    return sendServerError(
      res,
      'Failed to get recent search',
      error,
      'Could not get recent search.'
    );
  }
});

module.exports = router;
