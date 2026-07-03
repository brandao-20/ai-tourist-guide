import axios from 'axios';
import { getApiUrl } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
  const googleLogin = document.querySelector('.google-login');
  if (googleLogin) {
    googleLogin.href = getApiUrl('/auth/google');
  }

  const loginForm = document.getElementById('login-form');

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      console.log('Login form submitted'); // For debugging

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();

      if (!email || !password) {
        alert('Please fill in all fields.');
        return;
      }

      try {
        const response = await axios.post(
          getApiUrl('/api/users/login'),
          { email, password },
          { withCredentials: true } // To send cookies
        );

        if (response.status === 200) {
          alert('Login successful!');
          window.location.href = '/home_logged.html'; // Redirect to the page after login
        } else {
          alert(`Error logging in: ${response.data.message}`);
        }
      } catch (error) {
        console.error('Error logging in:', error);
        if (error.response && error.response.data && error.response.data.message) {
          alert(`Error logging in: ${error.response.data.message}`);
        } else {
          alert('Error logging in. Please try again later.');
        }
      }
    });
  } else {
    console.error('Login form not found.');
  }
});
