const NOTIFICATION_CONTAINER_ID = 'app-notifications';
const NOTIFICATION_TIMEOUT_MS = 5200;

function getNotificationContainer() {
  let container = document.getElementById(NOTIFICATION_CONTAINER_ID);
  if (container) {
    return container;
  }

  container = document.createElement('div');
  container.id = NOTIFICATION_CONTAINER_ID;
  container.className = 'toast-stack';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'false');
  document.body.appendChild(container);
  return container;
}

function removeToast(toast) {
  toast.classList.add('toast-message--leaving');
  window.setTimeout(() => toast.remove(), 180);
}

export function configureNotifications() {
  getNotificationContainer();
}

function showToast(type, message) {
  const text = String(message || '').trim();
  if (!text) {
    return;
  }

  const container = getNotificationContainer();
  const toast = document.createElement('div');
  toast.className = `toast-message toast-message--${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const content = document.createElement('span');
  content.textContent = text;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'toast-message__close';
  closeButton.setAttribute('aria-label', 'Dismiss notification');
  closeButton.textContent = '×';
  closeButton.addEventListener('click', () => removeToast(toast));

  toast.append(content, closeButton);
  container.appendChild(toast);
  window.setTimeout(() => removeToast(toast), NOTIFICATION_TIMEOUT_MS);
}

export function notifySuccess(message) {
  showToast('success', message);
}

export function notifyWarning(message) {
  showToast('warning', message);
}

export function notifyError(message) {
  showToast('error', message);
}

export function createNotifier() {
  return {
    success: notifySuccess,
    warning: notifyWarning,
    error: notifyError,
  };
}
