const express = require('express');
const router = express.Router();
const attractionController = require('../controllers/attractionController'); // Import the attraction controller
const authMiddleware = require('../middleware/authMiddleware'); // Import the authentication middleware

module.exports = router;
