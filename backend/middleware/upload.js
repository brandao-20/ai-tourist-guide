const multer = require('multer');
const path = require('path');

// Configure storage for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Directory where the files will be stored
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext); // Combine field name, unique suffix, and extension for the filename
  }
});

// Initialize the multer instance with the defined storage configuration
const upload = multer({ storage: storage });

module.exports = upload; // Export the multer instance for use in other parts of the application
