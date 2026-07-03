const { User } = require('../models');
const { sendNotFound, sendServerError, sendUnauthorized } = require('../utils/httpResponses');
const { normalizeSessionEmail } = require('../utils/sessionUser');

async function requireDbUser(req, res, next) {
  try {
    const email = normalizeSessionEmail(req);

    if (!email) {
      return sendUnauthorized(res, 'Authentication required.');
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return sendNotFound(res, 'Authenticated user was not found.');
    }

    req.authenticatedUser = user;
    req.authenticatedUserId = user.id;

    return next();
  } catch (error) {
    return sendServerError(res, 'Failed to resolve authenticated user', error);
  }
}

module.exports = requireDbUser;
