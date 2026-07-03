const express = require('express');
const {
  getCapabilitiesStatus,
  getHealthStatus,
  getReadinessStatus,
} = require('../services/healthService');
const { sendServerError } = require('../utils/httpResponses');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json(getHealthStatus());
});

router.get('/capabilities', (req, res) => {
  res.status(200).json(getCapabilitiesStatus());
});

router.get('/status', async (req, res) => {
  try {
    const { httpStatus, payload } = await getReadinessStatus();
    res.status(httpStatus).json(payload);
  } catch (error) {
    sendServerError(res, 'API status check failed', error, 'Unable to read API status.');
  }
});

module.exports = router;
