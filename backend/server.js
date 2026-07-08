/**
 * Express API for authentication, profile management, saved itineraries,
 * recent searches and configurable itinerary generation.
 */

const express = require('express');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const upload = require('./middleware/upload');
const { appConfig } = require('./config/env');
const { configurePassport } = require('./services/authService');
const { setSessionUser } = require('./utils/sessionUser');

const userRoutes = require('./routes/userRoutes');
const cityRoutes = require('./routes/cityRoutes');
const profileRoutes = require('./routes/profileRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const recentSearchRoutes = require('./routes/recentSearchRoutes');
const searchRoutes = require('./routes/searchRoutes');
const healthRoutes = require('./routes/healthRoutes');
const createSessionRouter = require('./routes/sessionRoutes');

const app = express();

app.use(cors({ origin: appConfig.cors.origins, credentials: true }));
app.use(express.json({ limit: appConfig.server.jsonBodyLimit }));
app.use(session({
  secret: appConfig.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    ...appConfig.session.cookie,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

const { googleOAuthEnabled } = configurePassport(passport);

app.use('/uploads', express.static(upload.uploadDir, {
  dotfiles: 'deny',
  index: false,
  maxAge: '1h',
}));

app.use('/api/users', userRoutes);
app.use('/api/cities', cityRoutes);
app.use('/api/user/profile', profileRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/recent_search', recentSearchRoutes);
app.use('/api/search', searchRoutes);
app.use('/api', healthRoutes);
app.use(createSessionRouter({ frontendUrl: appConfig.server.frontendUrl }));

function redirectToLoginWithAuthError(res, reason = 'google_failed') {
  res.redirect(`${appConfig.server.frontendUrl}/login?auth=${encodeURIComponent(reason)}`);
}

if (googleOAuthEnabled) {
  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  app.get('/auth/google/callback', (req, res, next) => {
    passport.authenticate('google', (error, user) => {
      if (error || !user) {
        redirectToLoginWithAuthError(res);
        return;
      }

      req.logIn(user, (loginError) => {
        if (loginError) {
          next(loginError);
          return;
        }

        setSessionUser(req, user);
        res.redirect(`${appConfig.server.frontendUrl}/dashboard`);
      });
    })(req, res, next);
  });
} else {
  const googleOAuthNotConfigured = (req, res) => {
    res.status(503).json({
      error: 'Google sign-in is not configured for this environment.',
      code: 'GOOGLE_OAUTH_DISABLED',
    });
  };

  app.get('/auth/google', googleOAuthNotConfigured);
  app.get('/auth/google/callback', googleOAuthNotConfigured);
}

app.get('/', (req, res) => {
  res.send('Personalized Tourist Guide AI API is running.');
});

app.use(upload.handleUploadError);

app.listen(appConfig.server.port, () => {
  console.log(`API server listening on port ${appConfig.server.port}`);
});
