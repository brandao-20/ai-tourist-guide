const express = require('express');
const { sendJson, sendServerError, sendUnauthorized } = require('../utils/httpResponses');

function createSessionRouter({ frontendUrl }) {
  const router = express.Router();

  router.get('/api/user', (req, res) => {
    if (!req.session.user) {
      return sendUnauthorized(res, 'Authentication required.');
    }

    return sendJson(res, 200, req.session.user);
  });

  router.get('/logout', (req, res) => {
    req.logout((error) => {
      if (error) {
        return sendServerError(res, 'Failed to log out user', error, 'Failed to log out.');
      }

      return req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect(frontendUrl);
      });
    });
  });

  return router;
}

module.exports = createSessionRouter;
