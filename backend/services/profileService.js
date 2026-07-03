const bcrypt = require('bcrypt');
const path = require('path');
const upload = require('../middleware/upload');
const { logServerWarning } = require('../utils/logger');
const { toPublicSessionUser } = require('../utils/sessionUser');

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_NAME_LENGTH = 120;

function normalizeProfileName(name) {
  return typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
}

function getProfilePassword(password) {
  return typeof password === 'string' ? password : '';
}

function validateProfileUpdatePayload(body = {}) {
  const name = normalizeProfileName(body.name);
  const password = getProfilePassword(body.password);

  if (!name) {
    return { error: 'Name is required.' };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Name must be ${MAX_NAME_LENGTH} characters or less.` };
  }

  if (password && password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` };
  }

  if (password && password.length > MAX_PASSWORD_LENGTH) {
    return { error: `Password must be ${MAX_PASSWORD_LENGTH} characters or less.` };
  }

  return {
    value: {
      name,
      password: password || null,
    },
  };
}

function isSafeStoredUploadFilename(filename) {
  if (typeof filename !== 'string' || !filename.trim()) {
    return false;
  }

  const normalized = filename.trim();

  return normalized === path.basename(normalized) && upload.isAllowedStoredFilename(normalized);
}

async function updateProfile(user, payload) {
  user.name = payload.name;

  if (payload.password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(payload.password, salt);
  }

  await user.save();
  return toPublicSessionUser(user);
}

async function updateProfileImage(user, file) {
  if (!file?.filename || !isSafeStoredUploadFilename(file.filename)) {
    return { error: 'A valid profile image is required.' };
  }

  const previousProfileImage = user.profileImage;
  user.profileImage = file.filename;
  await user.save();

  if (
    previousProfileImage &&
    previousProfileImage !== user.profileImage &&
    isSafeStoredUploadFilename(previousProfileImage)
  ) {
    try {
      await upload.removeStoredFile(previousProfileImage);
    } catch (error) {
      logServerWarning('Failed to remove previous profile image upload', error);
    }
  }

  return {
    value: {
      profileImage: user.profileImage,
      sessionUser: toPublicSessionUser(user),
    },
  };
}

module.exports = {
  updateProfile,
  updateProfileImage,
  validateProfileUpdatePayload,
};
