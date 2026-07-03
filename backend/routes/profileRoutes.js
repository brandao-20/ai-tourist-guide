const express = require('express');
const requireDbUser = require('../middleware/requireDbUser');
const upload = require('../middleware/upload');
const {
  updateProfile,
  updateProfileImage,
  validateProfileUpdatePayload,
} = require('../services/profileService');
const {
  sendJson,
  sendServerError,
  sendValidationError,
} = require('../utils/httpResponses');

const router = express.Router();

async function removeUploadedFileIfPresent(file) {
  if (!file?.filename) {
    return;
  }

  try {
    await upload.removeStoredFile(file.filename);
  } catch (error) {
    // Do not mask the original request failure with a cleanup failure.
  }
}

router.put('/', requireDbUser, async (req, res) => {
  const normalizedPayload = validateProfileUpdatePayload(req.body);

  if (normalizedPayload.error) {
    return sendValidationError(res, normalizedPayload.error);
  }

  try {
    const sessionUser = await updateProfile(req.authenticatedUser, normalizedPayload.value);
    req.session.user = sessionUser;

    return sendJson(res, 200, {
      message: 'Profile updated successfully.',
      user: sessionUser,
    });
  } catch (error) {
    return sendServerError(res, 'Failed to update user profile', error);
  }
});

router.put('/image', requireDbUser, upload.single('profileImage'), async (req, res) => {
  if (!req.file) {
    return sendValidationError(res, 'No image file was uploaded.');
  }

  try {
    const result = await updateProfileImage(req.authenticatedUser, req.file);

    if (result.error) {
      await removeUploadedFileIfPresent(req.file);
      return sendValidationError(res, result.error);
    }

    req.session.user = result.value.sessionUser;

    return sendJson(res, 200, {
      message: 'Profile image updated successfully.',
      profileImage: result.value.profileImage,
      user: result.value.sessionUser,
    });
  } catch (error) {
    await removeUploadedFileIfPresent(req.file);
    return sendServerError(res, 'Failed to update profile image', error);
  }
});

module.exports = router;
