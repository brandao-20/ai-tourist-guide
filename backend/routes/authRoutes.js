const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); // Import the user controller

// Route for user registration
router.post('/register', userController.createUser);
// Route for user login
router.post('/login', userController.loginUser);

module.exports = router;
