import { apiPost } from './api.js';
import {
  clearFieldErrors,
  getGoogleAuthErrorMessage,
  isValidEmail,
  setFieldError,
  setupGoogleOAuthButton,
  setupPasswordToggle,
} from './authPage.js';
import { clearStatusMessage, getErrorMessage, setButtonBusy, setStatusMessage } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const googleLogin = document.querySelector('.google-login');
  const oauthNote = document.getElementById('login-oauth-note');
  const loginForm = document.getElementById('login-form');
  const feedback = document.getElementById('login-feedback');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const emailError = document.getElementById('login-email-error');
  const passwordError = document.getElementById('login-password-error');
  const passwordToggle = document.querySelector('[data-toggle-password="password"]');

  setupGoogleOAuthButton({
    button: googleLogin,
    noteElement: oauthNote,
    feedbackElement: feedback,
  });

  setupPasswordToggle({ input: passwordInput, button: passwordToggle });

  const authErrorMessage = getGoogleAuthErrorMessage();
  if (authErrorMessage) {
    setStatusMessage(feedback, authErrorMessage, 'error');
    window.history.replaceState({}, document.title, window.location.pathname);
  }


  if (!loginForm) {
    return;
  }

  const fields = [
    { input: emailInput, errorElement: emailError },
    { input: passwordInput, errorElement: passwordError },
  ];

  fields.forEach(({ input, errorElement }) => {
    input?.addEventListener('input', () => setFieldError(input, errorElement, ''));
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatusMessage(feedback);
    clearFieldErrors(fields);

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    let hasValidationError = false;

    if (!email) {
      setFieldError(emailInput, emailError, 'Email is required.');
      hasValidationError = true;
    } else if (!isValidEmail(email)) {
      setFieldError(emailInput, emailError, 'Enter a valid email address.');
      hasValidationError = true;
    }

    if (!password) {
      setFieldError(passwordInput, passwordError, 'Password is required.');
      hasValidationError = true;
    }

    if (hasValidationError) {
      setStatusMessage(feedback, 'Check the highlighted fields before logging in.', 'error');
      return;
    }

    const submitButton = loginForm.querySelector('button[type="submit"]');
    const restoreButton = setButtonBusy(submitButton, 'Logging in...');

    try {
      await apiPost('/users/login', { email, password });
      setStatusMessage(feedback, 'Login successful. Redirecting to your dashboard...', 'success');
      window.location.href = '/dashboard';
    } catch (error) {
      setStatusMessage(feedback, getErrorMessage(error, 'We could not sign you in. Check your details and try again.'), 'error');
      restoreButton();
    }
  });
});
