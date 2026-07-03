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
      browserKeyExpected: true,
      serverGeocoding: Boolean(appConfig.googleMaps.serverApiKey),
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
  const ready = database.status === 'ok';

  return {
    httpStatus: ready ? 200 : 503,
    payload: {
      ...getBaseStatus(ready ? 'ready' : 'degraded'),
      checks: {
        database,
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
