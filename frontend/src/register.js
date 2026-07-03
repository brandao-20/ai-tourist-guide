import { apiPost } from './api.js';
import { buildFullName, isValidEmail, setupGoogleOAuthButton } from './authPage.js';
import { clearStatusMessage, getErrorMessage, setButtonBusy, setStatusMessage } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const googleRegister = document.querySelector('.google-register');
  const oauthNote = document.getElementById('register-oauth-note');
  const registerForm = document.getElementById('register-form');
  const feedback = document.getElementById('register-feedback');

  setupGoogleOAuthButton({
    button: googleRegister,
    noteElement: oauthNote,
    feedbackElement: feedback,
  });

  if (!registerForm) {
    return;
  }

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatusMessage(feedback);

    const firstName = document.getElementById('first-name').value.trim();
    const lastName = document.getElementById('last-name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!firstName || !lastName || !email || !password) {
      setStatusMessage(feedback, 'Please fill in all required fields.', 'error');
      return;
    }

    if (!isValidEmail(email)) {
      setStatusMessage(feedback, 'Please enter a valid email address.', 'error');
      return;
    }

    if (password.length < 8) {
      setStatusMessage(feedback, 'Password must have at least 8 characters.', 'error');
      return;
    }

    const submitButton = registerForm.querySelector('button[type="submit"]');
    const restoreButton = setButtonBusy(submitButton, 'Creating account...');

    try {
      await apiPost('/users/register', { name: buildFullName(firstName, lastName), email, password });
      setStatusMessage(feedback, 'Account created successfully. Redirecting to login...', 'success');
      window.setTimeout(() => {
        window.location.href = '/login.html';
      }, 700);
    } catch (error) {
      setStatusMessage(feedback, `Account creation failed: ${getErrorMessage(error, 'Please try again later.')}`, 'error');
      restoreButton();
    }
  });
});
