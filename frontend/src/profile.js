import { DEFAULT_AVATAR, getUploadUrl } from './config.js';
import { setStatusMessage } from './ui.js';
import { requireAuthenticatedSession, setupLogoutButton } from './session.js';

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
  element.textContent = value;
  }
}

function setProfileImage(user) {
  const profilePicture = document.getElementById('profile-pic');
  if (!profilePicture) {
  return;
  }

  const displayName = user.name || 'Traveller';
  profilePicture.src = user.profileImage ? getUploadUrl(user.profileImage) : DEFAULT_AVATAR;
  profilePicture.alt = `${displayName} profile picture`;
}

function updateUserProfile(user) {
  const statusElement = document.getElementById('profile-status');
  const displayName = user.name || 'Traveller';

  setText('user-name', displayName);
  setText('profile-name', displayName);
  setText('profile-email', user.email || 'Email not available');
  setProfileImage(user);
  setStatusMessage(statusElement, '', 'info');
}

document.addEventListener('DOMContentLoaded', async () => {
  setupLogoutButton();
  const statusElement = document.getElementById('profile-status');
  setStatusMessage(statusElement, 'Loading profile...', 'info');

  const user = await requireAuthenticatedSession({ next: '/profile' });
  if (!user) {
  return;
  }

  updateUserProfile(user);
});
