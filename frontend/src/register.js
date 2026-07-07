import { apiPost } from './api.js';
import {
  buildFullName,
  clearFieldErrors,
  isValidEmail,
  setFieldError,
  setupGoogleOAuthButton,
  setupPasswordToggle,
} from './authPage.js';
import { clearStatusMessage, getErrorMessage, setButtonBusy, setStatusMessage } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const googleRegister = document.querySelector('.google-register');
  const oauthNote = document.getElementById('register-oauth-note');
  const registerForm = document.getElementById('register-form');
  const feedback = document.getElementById('register-feedback');
  const firstNameInput = document.getElementById('first-name');
  const lastNameInput = document.getElementById('last-name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.querySelector('[data-toggle-password="password"]');

  const fieldErrors = {
    firstName: document.getElementById('register-first-name-error'),
    lastName: document.getElementById('register-last-name-error'),
    email: document.getElementById('register-email-error'),
    password: document.getElementById('register-password-error'),
  };

  setupGoogleOAuthButton({
    button: googleRegister,
    noteElement: oauthNote,
    feedbackElement: feedback,
  });

  setupPasswordToggle({ input: passwordInput, button: passwordToggle });

  if (!registerForm) {
    return;
  }

  const fields = [
    { input: firstNameInput, errorElement: fieldErrors.firstName },
    { input: lastNameInput, errorElement: fieldErrors.lastName },
    { input: emailInput, errorElement: fieldErrors.email },
    { input: passwordInput, errorElement: fieldErrors.password },
  ];

  fields.forEach(({ input, errorElement }) => {
    input?.addEventListener('input', () => setFieldError(input, errorElement, ''));
  });

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatusMessage(feedback);
    clearFieldErrors(fields);

    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    let hasValidationError = false;

    if (!firstName) {
      setFieldError(firstNameInput, fieldErrors.firstName, 'First name is required.');
      hasValidationError = true;
    }

    if (!lastName) {
      setFieldError(lastNameInput, fieldErrors.lastName, 'Last name is required.');
      hasValidationError = true;
    }

    if (!email) {
      setFieldError(emailInput, fieldErrors.email, 'Email is required.');
      hasValidationError = true;
    } else if (!isValidEmail(email)) {
      setFieldError(emailInput, fieldErrors.email, 'Enter a valid email address.');
      hasValidationError = true;
    }

    if (!password) {
      setFieldError(passwordInput, fieldErrors.password, 'Password is required.');
      hasValidationError = true;
    } else if (password.length < 8) {
      setFieldError(passwordInput, fieldErrors.password, 'Use at least 8 characters.');
      hasValidationError = true;
    }

    if (hasValidationError) {
      setStatusMessage(feedback, 'Check the highlighted fields before creating the account.', 'error');
      return;
    }

    const submitButton = registerForm.querySelector('button[type="submit"]');
    const restoreButton = setButtonBusy(submitButton, 'Creating account...');

    try {
      await apiPost('/users/register', { name: buildFullName(firstName, lastName), email, password });
      setStatusMessage(feedback, 'Account created successfully. Redirecting to login...', 'success');
      window.setTimeout(() => {
        window.location.href = '/login';
      }, 700);
    } catch (error) {
      setStatusMessage(feedback, getErrorMessage(error, 'We could not create your account right now. Please try again.'), 'error');
      restoreButton();
    }
  });
});
