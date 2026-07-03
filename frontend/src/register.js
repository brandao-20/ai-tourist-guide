import axios from 'axios';
import { getApiUrl } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
  const googleRegister = document.querySelector('.google-register');
  if (googleRegister) {
    googleRegister.href = getApiUrl('/auth/google');
  }

  const registerForm = document.getElementById('register-form');

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const firstName = document.getElementById('first-name').value.trim();
      const lastName = document.getElementById('last-name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();

      if (!firstName || !lastName || !email || !password) {
        alert('Please fill in all fields.');
        return;
      }

      const name = `${firstName} ${lastName}`;

      try {
        const response = await axios.post(
          getApiUrl('/api/users/register'),
          { name, email, password },
          { withCredentials: true }
        );

        if (response.status === 201) {
          alert('Account successfully created!');
          window.location.href = '/login.html';
        } else {
          alert(`Error creating account: ${response.data.message}`);
        }
      } catch (error) {
        console.error('Error registering user:', error);
        if (error.response && error.response.data && error.response.data.message) {
          alert(`Error creating account: ${error.response.data.message}`);
        } else {
          alert('Error creating account. Please try again later.');
        }
      }
    });
  } else {
    console.error('Registration form not found.');
  }
});
