import { apiGet } from './api.js';
import { getUploadUrl } from './config.js';
import { setStatusMessage } from './ui.js';

import { setupLogoutButton } from './session.js';
setupLogoutButton();
const DEFAULT_AVATAR = 'default-avatar.svg';

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

async function updateUserProfile() {
    const statusElement = document.getElementById('profile-status');
    setStatusMessage(statusElement, 'Loading profile...', 'info');

    try {
        const user = await apiGet('/user');
        const displayName = user.name || 'Traveller';

        setText('user-name', displayName);
        setText('profile-name', displayName);
        setText('profile-email', user.email || 'Email not available');
        setProfileImage(user);
        setStatusMessage(statusElement, '', 'info');
    } catch (error) {
        setStatusMessage(statusElement, 'Session expired. Redirecting to login...', 'error');
        window.location.href = '/login';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateUserProfile();
});
