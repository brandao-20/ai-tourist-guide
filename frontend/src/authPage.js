import { apiGet } from './api.js';
import { getApiUrl } from './config.js';
import { setStatusMessage } from './ui.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GOOGLE_UNAVAILABLE_MESSAGE = 'Google sign-in is not configured in this demo. Use the local account form instead.';
const GOOGLE_STATUS_ERROR_MESSAGE = 'Google sign-in availability could not be checked. Use the local account form for now.';

export function isValidEmail(email) {
  return EMAIL_REGEX.test(String(email || '').trim());
}

export function buildFullName(firstName, lastName) {
  return `${firstName || ''} ${lastName || ''}`.replace(/\s+/g, ' ').trim();
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

  disableOAuthButton(button, 'Checking Google sign-in availability...');
  setOAuthNote(noteElement, 'Checking Google sign-in availability...', 'info');

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
      enableOAuthButton(button);
      setOAuthNote(noteElement, 'Google sign-in is available for this environment.', 'success');
      return;
    }

    disableOAuthButton(button, GOOGLE_UNAVAILABLE_MESSAGE);
    setOAuthNote(noteElement, GOOGLE_UNAVAILABLE_MESSAGE, 'warning');
  } catch (error) {
    disableOAuthButton(button, GOOGLE_STATUS_ERROR_MESSAGE);
    setOAuthNote(noteElement, GOOGLE_STATUS_ERROR_MESSAGE, 'warning');
  }
}
