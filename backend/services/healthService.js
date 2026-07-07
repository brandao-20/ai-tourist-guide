const db = require('../models');
const { appConfig } = require('../config/env');

const SERVICE_NAME = 'personalized-tourist-guide-ai-api';

function getBaseStatus(status) {
  return {
    status,
    service: SERVICE_NAME,
    environment: appConfig.env,
    timestamp: new Date().toISOString(),
  };
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function checkDatabase() {
  try {
    await withTimeout(
      db.sequelize.authenticate(),
      appConfig.health.timeoutMs,
      'Database readiness check'
    );

    return { status: 'ok' };
  } catch (error) {
    return { status: 'unavailable' };
  }
}

function checkGoogleMapsServerKey() {
  return {
    status: appConfig.googleMaps.serverApiKey ? 'ok' : 'optional',
  };
}

function getPublicCapabilities() {
  return {
    auth: {
      local: true,
      googleOAuth: appConfig.googleOAuth.enabled,
    },
    ai: {
      provider: appConfig.ai.provider,
    },
    maps: {
      required: false,
      browserKeyExpected: true,
      serverGeocoding: Boolean(appConfig.googleMaps.serverApiKey),
      routePlanning: appConfig.googleMaps.serverApiKey ? 'google-maps' : 'list-fallback',
    },
    googleRoutes: {
      enabled: Boolean(appConfig.googleRoutes.apiKey),
    },
    googlePlaces: {
      enabled: Boolean(appConfig.googlePlaces.apiKey),
    },
  };
}

function getHealthStatus() {
  return {
    ...getBaseStatus('ok'),
    uptimeSeconds: Math.floor(process.uptime()),
  };
}

function getCapabilitiesStatus() {
  return {
    ...getBaseStatus('ok'),
    capabilities: getPublicCapabilities(),
  };
}

async function getReadinessStatus() {
  const database = await checkDatabase();
  const googleMapsServerKey = checkGoogleMapsServerKey();
  const ready = database.status === 'ok';

  return {
    httpStatus: ready ? 200 : 503,
    payload: {
      ...getBaseStatus(ready ? 'ready' : 'degraded'),
      checks: {
        database,
        googleMapsServerKey,
      },
      capabilities: getPublicCapabilities(),
    },
  };
}

module.exports = {
  getCapabilitiesStatus,
  getHealthStatus,
  getPublicCapabilities,
  getReadinessStatus,
};
