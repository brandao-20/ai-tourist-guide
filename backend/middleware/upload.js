const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const path = require('path');

const uploadDir = path.resolve(__dirname, '..', 'uploads');
const maxFileSizeBytes = 2 * 1024 * 1024;

const allowedImageTypes = new Map([
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/webp', ['.webp']],
  ['image/gif', ['.gif']],
]);

fs.mkdirSync(uploadDir, { recursive: true });

function getSafeFieldName(fieldName) {
  const safeName = String(fieldName || '')
    .replace(/[^a-z0-9_-]/gi, '')
    .toLowerCase();

  return safeName || 'file';
}

function getSafeExtension(file) {
  const originalExtension = path.extname(file.originalname || '').toLowerCase();
  const allowedExtensions = allowedImageTypes.get(file.mimetype) || [];

  return allowedExtensions.includes(originalExtension)
    ? originalExtension
    : allowedExtensions[0];
}

function getStoredFilePath(filename) {
  if (typeof filename !== 'string' || !filename.trim()) {
    return null;
  }

  const safeFilename = path.basename(filename.trim());
  const resolvedPath = path.resolve(uploadDir, safeFilename);

  if (!resolvedPath.startsWith(`${uploadDir}${path.sep}`)) {
    return null;
  }

  return resolvedPath;
}

function isAllowedStoredFilename(filename) {
  const storedFilePath = getStoredFilePath(filename);
  const extension = path.extname(filename || '').toLowerCase();

  return Boolean(
    storedFilePath &&
    Array.from(allowedImageTypes.values()).some((extensions) => extensions.includes(extension))
  );
}

async function removeStoredFile(filename) {
  if (!isAllowedStoredFilename(filename)) {
    return false;
  }

  const storedFilePath = getStoredFilePath(filename);

  try {
    await fs.promises.unlink(storedFilePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const fieldName = getSafeFieldName(file.fieldname);
    const extension = getSafeExtension(file);
    cb(null, `${fieldName}-${crypto.randomUUID()}${extension}`);
  },
});

function fileFilter(req, file, cb) {
  const originalExtension = path.extname(file.originalname || '').toLowerCase();
  const allowedExtensions = allowedImageTypes.get(file.mimetype);

  if (!allowedExtensions || !allowedExtensions.includes(originalExtension)) {
    const error = new Error('Only JPEG, PNG, WebP or GIF image files are allowed.');
    error.code = 'UNSUPPORTED_FILE_TYPE';
    return cb(error);
  }

  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: 1,
    fileSize: maxFileSizeBytes,
  },
});

upload.uploadDir = uploadDir;
upload.isAllowedStoredFilename = isAllowedStoredFilename;
upload.removeStoredFile = removeStoredFile;
upload.handleUploadError = (error, req, res, next) => {
  if (!error) {
    return next();
  }

  if (error instanceof multer.MulterError || error.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({ error: error.message });
  }

  return next(error);
};

module.exports = upload;
