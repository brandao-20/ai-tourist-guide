const express = require('express');
const passport = require('passport');
const {
  loginLocalUser,
  normalizeRegistrationPayload,
  registerLocalUser,
} = require('../services/authService');
const {
  sendJson,
  sendServerError,
  sendUnauthorized,
  sendValidationError,
} = require('../utils/httpResponses');

const router = express.Router();

router.post('/register', async (req, res) => {
  const normalizedPayload = normalizeRegistrationPayload(req.body);

  if (normalizedPayload.error) {
    return sendValidationError(res, normalizedPayload.error);
  }

  try {
    const result = await registerLocalUser(normalizedPayload.value);

    if (result.error) {
      return sendJson(res, result.statusCode || 400, { error: result.error });
    }

    return sendJson(res, 201, {
      message: 'User successfully registered.',
      user: result.value,
    });
  } catch (error) {
    return sendServerError(res, 'Failed to register user', error, 'We could not create your account right now. Please try again.');
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const result = await loginLocalUser(req, res, next, passport);

    if (result.error) {
      if (result.statusCode === 401) {
        return sendUnauthorized(res, result.error);
      }

      return sendValidationError(res, result.error);
    }

    return sendJson(res, 200, {
      message: 'Login successful.',
      user: result.value,
    });
  } catch (error) {
    return sendServerError(res, 'Failed to authenticate user', error, 'We could not sign you in. Check your details and try again.');
  }
});

module.exports = router;
