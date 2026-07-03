const { logServerError } = require('./logger');

function sendJson(res, statusCode, payload) {
  return res.status(statusCode).json(payload);
}

function sendValidationError(res, message) {
  return sendJson(res, 400, { error: message });
}

function sendNotFound(res, message) {
  return sendJson(res, 404, { error: message });
}

function sendUnauthorized(res, message = 'Authentication required.') {
  return sendJson(res, 401, { error: message });
}

function sendServerError(res, context, error, publicMessage = 'Internal server error.') {
  logServerError(context, error);
  return sendJson(res, 500, { error: publicMessage });
}

module.exports = {
  sendJson,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
  sendServerError,
};
