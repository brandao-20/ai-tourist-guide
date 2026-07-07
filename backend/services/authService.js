const bcrypt = require('bcrypt');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const db = require('../models');
const { appConfig, hasConfiguredValue } = require('../config/env');
const { logServerError } = require('../utils/logger');
const { setSessionUser, toPublicSessionUser } = require('../utils/sessionUser');
const { loginSchema, parseSchema, registerSchema } = require('../schemas/validationSchemas');

function normalizeName(name) {
  return typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function getPassword(password) {
  return typeof password === 'string' ? password : '';
}

function getGoogleOAuthConfig() {
  return appConfig.googleOAuth;
}


function normalizeRegistrationPayload(body = {}) {
  return parseSchema(registerSchema, body);
}

function normalizeLoginPayload(body = {}) {
  return parseSchema(loginSchema, body);
}

async function registerLocalUser(payload) {
  const existingUser = await db.User.findOne({ where: { email: payload.email } });
  if (existingUser) {
    return { error: 'Email already registered.', statusCode: 409 };
  }

  const user = await db.User.create(payload);

  return {
    value: toPublicSessionUser(user),
  };
}

async function verifyLocalCredentials(email, password, done) {
  try {
    const normalizedEmail = normalizeEmail(email);
    const user = await db.User.findOne({ where: { email: normalizedEmail } });

    if (!user || !user.password) {
      return done(null, false, { message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return done(null, false, { message: 'Invalid credentials.' });
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}

function getGoogleProfileEmail(profile) {
  const firstEmail = Array.isArray(profile?.emails) ? profile.emails[0]?.value : null;
  return normalizeEmail(firstEmail);
}

async function findOrCreateGoogleUser(profile) {
  const googleId = typeof profile?.id === 'string' ? profile.id : '';
  const email = getGoogleProfileEmail(profile);
  const name = normalizeName(profile?.displayName) || email || 'Google user';

  if (!googleId || !email) {
    throw new Error('Google profile is missing required account data.');
  }

  let user = await db.User.findOne({ where: { google_id: googleId } });
  if (user) {
    return user;
  }

  user = await db.User.findOne({ where: { email } });
  if (user) {
    if (!user.google_id) {
      user.google_id = googleId;
      await user.save();
    }

    return user;
  }

  return db.User.create({
    name,
    email,
    google_id: googleId,
    profileImage: null,
  });
}

function configurePassport(passport) {
  const googleOAuthConfig = getGoogleOAuthConfig();

  if (googleOAuthConfig.enabled) {
    passport.use(
      new GoogleStrategy(
        googleOAuthConfig.strategyOptions,
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const user = await findOrCreateGoogleUser(profile);
            return done(null, user);
          } catch (error) {
            logServerError('Google OAuth strategy failed', error);
            return done(error, null);
          }
        }
      )
    );
  }

  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
      },
      verifyLocalCredentials
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await db.User.findByPk(id);
      done(null, user);
    } catch (error) {
      logServerError('Failed to deserialize user', error);
      done(error, null);
    }
  });

  return {
    googleOAuthEnabled: googleOAuthConfig.enabled,
  };
}

function loginLocalUser(req, res, next, passport) {
  const normalizedPayload = normalizeLoginPayload(req.body);

  if (normalizedPayload.error) {
    return Promise.resolve({ error: normalizedPayload.error, statusCode: 400 });
  }

  req.body.email = normalizedPayload.value.email;
  req.body.password = normalizedPayload.value.password;

  return new Promise((resolve, reject) => {
    passport.authenticate('local', (error, user) => {
      if (error) {
        reject(error);
        return;
      }

      if (!user) {
        resolve({ error: 'Invalid credentials.', statusCode: 401 });
        return;
      }

      req.logIn(user, (loginError) => {
        if (loginError) {
          reject(loginError);
          return;
        }

        resolve({ value: setSessionUser(req, user) });
      });
    })(req, res, next);
  });
}

module.exports = {
  configurePassport,
  getGoogleOAuthConfig,
  hasConfiguredValue,
  loginLocalUser,
  normalizeLoginPayload,
  normalizeRegistrationPayload,
  registerLocalUser,
};
