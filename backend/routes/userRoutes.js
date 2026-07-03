const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcrypt');
const { User } = require('../models');

// Registration route
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    // Create the user (password will be hashed by the beforeCreate hook)
    const user = await User.create({
      name,
      email,
      password,
    });

    res.status(201).json({ message: 'User successfully registered.' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Error registering user.' });
  }
});

// Login route
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) { 
      console.error('Error during authentication:', err);
      return res.status(500).json({ message: 'Server error during login.' });
    }
    if (!user) { 
      return res.status(401).json({ message: info.message || 'Login failed.' });
    }
    req.logIn(user, (err) => {
      if (err) { 
        console.error('Error logging in:', err);
        return res.status(500).json({ message: 'Error logging in.' });
      }
      // Store user information in the session
      req.session.user = {
        name: user.name,
        email: user.email,
      };
      console.log('Sessão após login:', req.session.user);
      return res.status(200).json({ message: 'Login successful.' });
    });
  })(req, res, next);
});

module.exports = router;
