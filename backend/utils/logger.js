const { appConfig } = require('../config/env');

function getSafeMessage(error) {
  return error?.message || 'Unexpected server error';
}

function logServerError(context, error) {
  const message = getSafeMessage(error);

  if (appConfig.isProduction) {
    console.error(`${context}: ${message}`);
    return;
  }

  console.error(context, error || message);
}

function logServerWarning(context, details) {
  if (details === undefined || details === null || details === '') {
    console.warn(context);
    return;
  }

  if (appConfig.isProduction) {
    console.warn(context);
    return;
  }

  console.warn(context, details);
}

module.exports = {
  logServerError,
  logServerWarning,
};
