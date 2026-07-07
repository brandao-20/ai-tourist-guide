import { apiGet, apiPut } from './api.js';
import { getUploadUrl } from './config.js';
import { getErrorMessage, setButtonBusy, setStatusMessage } from './ui.js';

const DEFAULT_AVATAR = 'default-avatar.svg';
const MAX_CLIENT_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function getElement(id) {
    return document.getElementById(id);
}

function getStatusElement() {
    return getElement('edit-profile-status');
}

function setProfileStatus(message, type = 'info') {
    setStatusMessage(getStatusElement(), message, type);
}

function validateSelectedImage(file) {
    if (!file) {
        return null;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return 'Please choose a valid image file: JPG, PNG, WEBP or GIF.';
    }

    if (file.size > MAX_CLIENT_IMAGE_SIZE_BYTES) {
        return 'Profile image must be 2 MB or smaller.';
    }

    return null;
}

function previewSelectedImage(file) {
    const profilePicture = getElement('profile-pic');
    if (!profilePicture || !file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        profilePicture.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function toggleEdit(inputElement, buttonElement) {
    if (!inputElement || !buttonElement) {
        return;
    }

    const isReadOnly = inputElement.readOnly;
    inputElement.readOnly = !isReadOnly;
    buttonElement.innerHTML = isReadOnly
        ? '<i class="fas fa-check"></i>'
        : '<i class="fas fa-pencil-alt"></i>';

    if (isReadOnly) {
        inputElement.focus();
    }
}

async function loadUserData() {
    setProfileStatus('Loading profile...', 'info');

    try {
        const user = await apiGet('/user');
        const nameInput = getElement('name');
        const emailInput = getElement('email');
        const profilePicture = getElement('profile-pic');

        if (nameInput) {
            nameInput.value = user.name || '';
        }

        if (emailInput) {
            emailInput.value = user.email || '';
        }

        if (profilePicture) {
            const displayName = user.name || 'Traveller';
            profilePicture.src = user.profileImage ? getUploadUrl(user.profileImage) : DEFAULT_AVATAR;
            profilePicture.alt = `${displayName} profile picture`;
        }

        setProfileStatus('', 'info');
    } catch (error) {
        setProfileStatus('Session expired. Redirecting to login...', 'error');
        window.location.href = '/login';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    let selectedFile = null;

    loadUserData();

    const editNameButton = getElement('edit-name');
    if (editNameButton) {
        editNameButton.addEventListener('click', (event) => {
            event.preventDefault();
            toggleEdit(getElement('name'), editNameButton);
        });
    }

    const editPasswordButton = getElement('edit-password');
    if (editPasswordButton) {
        editPasswordButton.addEventListener('click', (event) => {
            event.preventDefault();
            toggleEdit(getElement('password'), editPasswordButton);
        });
    }

    const cancelButton = document.querySelector('.cancel-button');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            window.location.href = '/profile';
        });
    }

    const editProfilePicButton = getElement('edit-profile-pic');
    const profileImageInput = getElement('profileImageInput');

    if (editProfilePicButton && profileImageInput) {
        editProfilePicButton.addEventListener('click', (event) => {
            event.preventDefault();
            profileImageInput.click();
        });

        profileImageInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            const validationError = validateSelectedImage(file);

            if (validationError) {
                selectedFile = null;
                profileImageInput.value = '';
                setProfileStatus(validationError, 'error');
                return;
            }

            selectedFile = file || null;
            if (selectedFile) {
                previewSelectedImage(selectedFile);
                setProfileStatus('Image selected. Save changes to upload it.', 'success');
            }
        });
    }

    const editProfileForm = document.querySelector('.edit-form');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const nameInput = getElement('name');
            const passwordInput = getElement('password');
            const saveButton = editProfileForm.querySelector('.save-button');
            const restoreButton = setButtonBusy(saveButton, 'Saving...');

            const name = nameInput?.value.trim() || '';
            const password = passwordInput?.value || '';

            if (!name) {
                restoreButton();
                setProfileStatus('Name is required.', 'error');
                nameInput?.focus();
                return;
            }

            if (password && password.length < 8) {
                restoreButton();
                setProfileStatus('Password must have at least 8 characters.', 'error');
                passwordInput?.focus();
                return;
            }

            const updatedData = {
                name,
            };
            if (password) {
                updatedData.password = password;
            }

            try {
                await apiPut('/user/profile', updatedData);

                if (selectedFile) {
                    const formData = new FormData();
                    formData.append('profileImage', selectedFile);
                    await apiPut('/user/profile/image', formData);
                }

                setProfileStatus('Profile updated successfully. Redirecting...', 'success');
                window.location.href = '/profile';
            } catch (error) {
                setProfileStatus(getErrorMessage(error, 'Failed to update profile. Please try again.'), 'error');
            } finally {
                restoreButton();
            }
        });
    }
});
