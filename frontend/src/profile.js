import axios from 'axios';
import { getApiUrl, getUploadUrl } from './config.js';

document.addEventListener("DOMContentLoaded", () => {
    console.log("Profile page loaded");

    // Function to update user data on the page
    const updateUserProfile = async () => {
        try {
            console.log("Requesting data from /api/user");
            const response = await axios.get(getApiUrl('/api/user'), { withCredentials: true }); // Fetch user data with credentials
            const user = response.data;

            console.log('User data received:', user);

            // Update the user's name
            const userNameElement = document.getElementById('user-name');
            if (userNameElement) {
                userNameElement.textContent = user.name || 'Name not available';
                console.log('User name updated to:', user.name);
            } else {
                console.warn('Element with id "user-name" not found.');
            }

            // Update the user's profile picture
            const profilePicElement = document.getElementById('profile-pic');
            if (profilePicElement) {
                profilePicElement.src = user.profileImage ? getUploadUrl(user.profileImage) : 'default-avatar.svg';
                console.log('Profile picture updated.');
            }

            // Update personal information fields
            const infoFields = {
                'info-name': user.name || 'Name not available',
                'info-email': user.email || 'Email not available',
                // Add other fields as needed
            };

            // Populate information fields
            for (const [id, value] of Object.entries(infoFields)) {
                const inputElement = document.getElementById(id);
                if (inputElement) {
                    inputElement.value = value;
                    console.log(`Field ${id} updated with value: ${value}`);
                }
            }

        } catch (error) {
            console.error('Error fetching user data:', error);
            // Optional: Redirect to login page if the user is not authenticated
            window.location.href = '/login.html';
        }
    };

    // Call the function to update the user's profile
    updateUserProfile();

    // Add functionality to the "Edit" button
    const editButton = document.querySelector('.edit-button');
    if (editButton) {
        editButton.addEventListener('click', () => {
            // Redirect to the profile edit page or open a modal
            window.location.href = '/edit_profile.html'; // Adjust based on your project structure
        });
    }

    // Optional functionality to toggle password visibility
    const viewPasswordButton = document.querySelector('.view-password');
    const passwordInput = document.getElementById('info-password');

    if (viewPasswordButton && passwordInput) {
        viewPasswordButton.addEventListener('click', () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text'; // Show the password
                viewPasswordButton.textContent = '🙈'; // Update button text to indicate hidden mode
            } else {
                passwordInput.type = 'password'; // Hide the password
                viewPasswordButton.textContent = '👁️'; // Update button text to indicate visible mode
            }
        });
    }
});
