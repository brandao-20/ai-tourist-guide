const express = require('express');
const { runItinerarySearch } = require('../services/itinerarySearchService');
const { logServerError } = require('../utils/logger');
const { normalizeSearchPayload } = require('../utils/payloadValidation');

const router = express.Router();

router.post('/', async (req, res) => {
  const searchPayload = normalizeSearchPayload(req.body);

  if (searchPayload.error) {
    return res.status(400).json({ error: searchPayload.error });
  }

  try {
    const result = await runItinerarySearch(searchPayload.value, {
      userPreferences: req.session?.user?.travelPreferences || null,
    });
    return res.json(result);
  } catch (error) {
    logServerError('Failed to process travel search', error);
    return res.status(500).json({ error: 'Unable to process the travel search request.' });
  }
});

module.exports = router;
