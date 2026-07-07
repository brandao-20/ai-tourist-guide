const bcrypt = require('bcrypt');
const path = require('path');
const upload = require('../middleware/upload');
const { logServerWarning } = require('../utils/logger');
const { toPublicSessionUser } = require('../utils/sessionUser');
const { normalizeTravelPreferences } = require('./userPreferenceService');
const { parseSchema, profileUpdateSchema } = require('../schemas/validationSchemas');

function validateProfileUpdatePayload(body = {}) {
  return parseSchema(profileUpdateSchema, body);
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

  if (payload.travelPreferences !== undefined) {
    user.travelPreferences = normalizeTravelPreferences(payload.travelPreferences);
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
