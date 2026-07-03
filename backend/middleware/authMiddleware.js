// Middleware function to check if the user is authenticated
function isAuthenticated(req, res, next) {
  // Check if a session exists and if it contains a user object
  if (req.session && req.session.user) {
    return next();
  } else {
    return res.status(401).json({ message: 'Unauthenticated user.' });
  }
}

module.exports = { isAuthenticated }; // Export the middleware for use in other parts of the application
