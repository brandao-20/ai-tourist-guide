import { apiPost } from './api.js';
import {
  getGoogleAuthErrorMessage,
  isValidEmail,
  setupGoogleOAuthButton,
} from './authPage.js';
import { clearStatusMessage, getErrorMessage, setButtonBusy, setStatusMessage } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const googleLogin = document.querySelector('.google-login');
  const oauthNote = document.getElementById('login-oauth-note');
  const loginForm = document.getElementById('login-form');
  const feedback = document.getElementById('login-feedback');

  setupGoogleOAuthButton({
    button: googleLogin,
    noteElement: oauthNote,
    feedbackElement: feedback,
  });

  const authErrorMessage = getGoogleAuthErrorMessage();
  if (authErrorMessage) {
    setStatusMessage(feedback, authErrorMessage, 'error');
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  if (!loginForm) {
    return;
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatusMessage(feedback);

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      setStatusMessage(feedback, 'Please fill in your email and password.', 'error');
      return;
    }

    if (!isValidEmail(email)) {
      setStatusMessage(feedback, 'Please enter a valid email address.', 'error');
      return;
    }

    const submitButton = loginForm.querySelector('button[type="submit"]');
    const restoreButton = setButtonBusy(submitButton, 'Logging in...');

    try {
      await apiPost('/users/login', { email, password });
      setStatusMessage(feedback, 'Login successful. Redirecting...', 'success');
      window.location.href = '/home_logged.html';
    } catch (error) {
      setStatusMessage(feedback, `Login failed: ${getErrorMessage(error, 'Please try again later.')}`, 'error');
      restoreButton();
    }
  });
});
