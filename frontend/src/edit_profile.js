import axios from 'axios';
import { getApiUrl, getUploadUrl } from './config.js';

document.addEventListener("DOMContentLoaded", () => {
    console.log("Edit Profile page loaded");

    let selectedFile = null; // Variable to store the selected image file

    // Load user data from the server
    const loadUserData = async () => {
        try {
            const response = await axios.get(getApiUrl('/api/user'), { withCredentials: true });
            const user = response.data;

            // Populate input fields with user data
            const nameInput = document.getElementById('name');
            const emailInput = document.getElementById('email');
            const profilePic = document.getElementById('profile-pic');

            if (nameInput) {
                nameInput.value = user.name || '';
            }

            if (emailInput) {
                emailInput.value = user.email || '';
            }

            if (profilePic) {
                profilePic.src = user.profileImage ? getUploadUrl(user.profileImage) : 'default-avatar.svg';
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            alert('Failed to load user data. Please try again.');
            window.location.href = '/login.html'; // Redirect to login page
        }
    };

    // Call the function to load user data
    loadUserData();

    // Function to toggle editing for input fields
    const toggleEdit = (inputElement, buttonElement) => {
        if (inputElement.readOnly) {
            inputElement.readOnly = false;
            inputElement.focus();
            buttonElement.innerHTML = '<i class="fas fa-check"></i>'; // Change icon to checkmark
        } else {
            inputElement.readOnly = true;
            buttonElement.innerHTML = '<i class="fas fa-pencil-alt"></i>'; // Change icon back to pencil
        }
    };

    // Edit user name
    const editNameButton = document.getElementById('edit-name');
    if (editNameButton) {
        const nameInput = document.getElementById('name');
        editNameButton.addEventListener('click', (e) => {
            e.preventDefault();
            toggleEdit(nameInput, editNameButton);
        });
    }

    // Edit password
    const editPasswordButton = document.getElementById('edit-password');
    if (editPasswordButton) {
        const passwordInput = document.getElementById('password');
        editPasswordButton.addEventListener('click', (e) => {
            e.preventDefault();
            toggleEdit(passwordInput, editPasswordButton);
        });
    }

    // Cancel button functionality
    const cancelButton = document.querySelector('.cancel-button');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            window.location.href = '/profile.html'; // Redirect to the profile page
        });
    }

    // Edit profile picture
    const editProfilePicButton = document.getElementById('edit-profile-pic');
    const profileImageInput = document.getElementById('profileImageInput');

    if (editProfilePicButton && profileImageInput) {
        // Open file selection dialog when clicking the pencil icon
        editProfilePicButton.addEventListener('click', (e) => {
            e.preventDefault();
            profileImageInput.click();
        });

        // Handle file selection
        profileImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                selectedFile = file;

                // Show a preview of the selected image
                const reader = new FileReader();
                reader.onload = (event) => {
                    const profilePic = document.getElementById('profile-pic');
                    if (profilePic) {
                        profilePic.src = event.target.result; // Display the chosen image
                    }
                };
                reader.readAsDataURL(file);
            } else {
                selectedFile = null; // Clear selected file if no file chosen
            }
        });
    }

    // Form submission (Save changes)
    const editProfileForm = document.querySelector('.edit-form');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('name').value.trim();
            const password = document.getElementById('password').value;

            if (!name) {
                alert('Name is required.');
                return;
            }

            const updatedData = { name };
            if (password) {
                updatedData.password = password;
            }

            try {
                // First update name and password
                await axios.put(getApiUrl('/api/user/profile'), updatedData, { withCredentials: true });
                console.log('Profile (name/password) updated successfully.');

                // If a file was selected, upload the profile image
                if (selectedFile) {
                    const formData = new FormData();
                    formData.append('profileImage', selectedFile);

                    const response = await fetch(getApiUrl('/api/user/profile/image'), {
                        method: 'PUT',
                        credentials: 'include',
                        body: formData
                    });

                    const result = await response.json();
                    if (!response.ok) {
                        alert('Failed to update profile image: ' + (result.error || 'Unknown error'));
                        return;
                    }

                    console.log('Profile image updated successfully!');
                }

                alert('Profile updated successfully.');
                window.location.href = '/profile.html';

            } catch (error) {
                console.error('Error updating profile:', error.response ? error.response.data : error);
                alert(error.response && error.response.data && error.response.data.error
                      ? error.response.data.error
                      : 'Failed to update profile. Please try again.');
            }
        });
    }
});
