import { apiGet } from './api.js';
import { getUploadUrl } from './config.js';
import { setStatusMessage } from './ui.js';

const DEFAULT_AVATAR = 'default-avatar.svg';

function setInputValue(id, value) {
    const input = document.getElementById(id);
    if (input) {
        input.value = value;
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

        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            userNameElement.textContent = displayName;
        }

        setProfileImage(user);
        setInputValue('info-name', displayName);
        setInputValue('info-email', user.email || 'Email not available');
        setInputValue('info-password', 'Hidden for security');
        setStatusMessage(statusElement, '', 'info');
    } catch (error) {
        setStatusMessage(statusElement, 'Session expired. Redirecting to login...', 'error');
        window.location.href = '/login.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateUserProfile();

    const editButton = document.querySelector('.edit-button');
    if (editButton) {
        editButton.addEventListener('click', () => {
            window.location.href = '/edit_profile.html';
        });
    }
});
