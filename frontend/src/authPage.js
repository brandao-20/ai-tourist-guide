import { apiGet } from './api.js';
import { getApiUrl } from './config.js';
import { setStatusMessage } from './ui.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GOOGLE_UNAVAILABLE_MESSAGE = 'Google sign-in is not configured yet. Add Google OAuth credentials to enable it.';
const GOOGLE_STATUS_ERROR_MESSAGE = 'Google sign-in status is temporarily unavailable. Email sign-in is still available.';

export function isValidEmail(email) {
  return EMAIL_REGEX.test(String(email || '').trim());
}

export function buildFullName(firstName, lastName) {
  return `${firstName || ''} ${lastName || ''}`.replace(/\s+/g, ' ').trim();
}


export function setFieldError(input, errorElement, message = '') {
  if (!input || !errorElement) {
    return;
  }

  errorElement.textContent = message;
  errorElement.classList.toggle('is-hidden', !message);

  if (message) {
    input.setAttribute('aria-invalid', 'true');
    return;
  }

  input.removeAttribute('aria-invalid');
}

export function clearFieldErrors(fields = []) {
  fields.forEach(({ input, errorElement }) => setFieldError(input, errorElement, ''));
}

export function setupPasswordToggle({ input, button }) {
  if (!input || !button) {
    return;
  }

  button.addEventListener('click', () => {
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    button.textContent = isHidden ? 'Hide' : 'Show';
    button.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  });
}

export function getGoogleAuthErrorMessage(searchParams = new URLSearchParams(window.location.search)) {
  const reason = searchParams.get('auth');

  if (!reason) {
    return '';
  }

  if (reason === 'google_failed') {
    return 'Google sign-in could not be completed. Use local login or try again later.';
  }

  return 'Authentication could not be completed. Use local login or try again later.';
}


function getOAuthContainer(button) {
  return button?.closest('.auth-provider-stack');
}

function showOAuthButton(button) {
  const container = getOAuthContainer(button);
  if (container) {
    container.hidden = false;
  }
  button.hidden = false;
}

function disableOAuthButton(button, message) {
  button.href = '#';
  button.classList.add('is-disabled');
  button.setAttribute('aria-disabled', 'true');
  button.dataset.disabledMessage = message;
}

function enableOAuthButton(button) {
  button.href = getApiUrl('/auth/google');
  button.classList.remove('is-disabled');
  button.removeAttribute('aria-disabled');
  delete button.dataset.disabledMessage;
}

function setOAuthNote(noteElement, message, type = 'info') {
  if (!noteElement) {
    return;
  }

  noteElement.textContent = message || '';
  noteElement.dataset.type = type;
  noteElement.classList.toggle('is-hidden', !message);
}

export async function setupGoogleOAuthButton({ button, noteElement, feedbackElement }) {
  if (!button) {
    return;
  }

  showOAuthButton(button);
  disableOAuthButton(button, GOOGLE_UNAVAILABLE_MESSAGE);
  setOAuthNote(noteElement, GOOGLE_UNAVAILABLE_MESSAGE, 'info');

  button.addEventListener('click', (event) => {
    if (button.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      setStatusMessage(
        feedbackElement,
        button.dataset.disabledMessage || GOOGLE_UNAVAILABLE_MESSAGE,
        'warning'
      );
    }
  });

  try {
    const status = await apiGet('/capabilities');
    const googleOAuthEnabled = Boolean(status?.capabilities?.auth?.googleOAuth);

    if (googleOAuthEnabled) {
      showOAuthButton(button);
      enableOAuthButton(button);
      setOAuthNote(noteElement, '', 'success');
      return;
    }

    showOAuthButton(button);
    disableOAuthButton(button, GOOGLE_UNAVAILABLE_MESSAGE);
    setOAuthNote(noteElement, GOOGLE_UNAVAILABLE_MESSAGE, 'info');
  } catch (error) {
    showOAuthButton(button);
    disableOAuthButton(button, GOOGLE_STATUS_ERROR_MESSAGE);
    setOAuthNote(noteElement, GOOGLE_STATUS_ERROR_MESSAGE, 'warning');
  }
}
