export function getElement(id) {
  return document.getElementById(id);
}

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function stripHtml(value = '') {
  const text = String(value);

  if (typeof document !== 'undefined') {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = text;
    return (wrapper.textContent || wrapper.innerText || '').replace(/\s+/g, ' ').trim();
  }

  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isValidNumericId(value) {
  return /^\d+$/.test(String(value));
}

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.code === 'NETWORK_ERROR' || error?.status === 0) {
    return 'The API is unavailable. Check whether the backend is running and API_BASE_URL is correct.';
  }

  return error?.data?.error || error?.data?.message || error?.message || fallback;
}

export function setStatusMessage(element, message, type = 'info') {
  if (!element) {
    return;
  }

  element.textContent = message || '';
  element.dataset.type = type;
  element.classList.toggle('is-hidden', !message);
}

export function clearStatusMessage(element) {
  setStatusMessage(element, '', 'info');
}

export function setButtonBusy(button, busyLabel = 'Loading...') {
  if (!button) {
    return () => {};
  }

  const previousText = button.textContent;
  const previousDisabled = button.disabled;

  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.classList.add('button--busy');
  button.textContent = busyLabel;

  return () => {
    button.disabled = previousDisabled;
    button.removeAttribute('aria-busy');
    button.classList.remove('button--busy');
    button.textContent = previousText;
  };
}

function createFavoriteNameModal() {
  const modal = document.createElement('div');
  modal.id = 'favoriteModal';
  modal.className = 'modal favorite-modal';
  modal.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="favoriteModalTitle">
      <button class="favorite-modal__close" id="favoriteModalClose" type="button" aria-label="Close dialog">×</button>
      <h2 id="favoriteModalTitle">Save favorite itinerary</h2>
      <p class="favorite-modal__intro">Name this route so it is easy to find later from the dashboard.</p>
      <label class="favorite-modal__field" for="favoriteNameInput">
        Itinerary name
        <input type="text" id="favoriteNameInput" maxlength="120" placeholder="Example: Lisbon weekend route" autocomplete="off">
      </label>
      <div class="favorite-modal__actions">
        <button id="favoriteModalCancel" type="button">Cancel</button>
        <button id="favoriteModalSave" type="button">Save itinerary</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  return modal;
}

export function showFavoriteNameModal(callback, options = {}) {
  const modal = document.getElementById('favoriteModal') || createFavoriteNameModal();
  const input = modal.querySelector('#favoriteNameInput');
  const closeButton = modal.querySelector('#favoriteModalClose');
  const cancelButton = modal.querySelector('#favoriteModalCancel');
  const saveButton = modal.querySelector('#favoriteModalSave');
  const title = modal.querySelector('#favoriteModalTitle');
  const intro = modal.querySelector('.favorite-modal__intro');

  const {
    defaultName = '',
    title: modalTitle = 'Save favorite itinerary',
    description = 'Name this route so it is easy to find later from the dashboard.',
    submitLabel = 'Save itinerary',
  } = options;

  const previousActiveElement = document.activeElement;

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
    }
  };

  function closeModal() {
    modal.style.display = 'none';
    document.removeEventListener('keydown', handleKeydown);
    previousActiveElement?.focus?.();
  }

  if (title) {
    title.textContent = modalTitle;
  }
  if (intro) {
    intro.textContent = description;
  }
  if (saveButton) {
    saveButton.textContent = submitLabel;
  }

  closeButton.onclick = closeModal;
  cancelButton.onclick = closeModal;
  saveButton.onclick = () => {
    const favoriteName = input.value.trim();
    if (!favoriteName) {
      input.setCustomValidity('Please enter a valid itinerary name.');
      input.reportValidity();
      input.focus();
      return;
    }

    input.setCustomValidity('');
    closeModal();
    callback(favoriteName);
  };

  modal.onclick = (event) => {
    if (event.target === modal) {
      closeModal();
    }
  };

  input.value = defaultName;
  input.placeholder = defaultName || 'Example: Lisbon weekend route';
  document.addEventListener('keydown', handleKeydown);
  modal.style.display = 'flex';
  input.focus();
  input.select();
}

const GLOBAL_NOTIFICATION_CONTAINER_ID = 'app-notifications';
const GLOBAL_NOTIFICATION_TIMEOUT_MS = 5200;
const CONFIRM_MODAL_ID = 'appConfirmModal';

function getNotificationContainer() {
  let container = document.getElementById(GLOBAL_NOTIFICATION_CONTAINER_ID);
  if (container) {
    return container;
  }

  container = document.createElement('div');
  container.id = GLOBAL_NOTIFICATION_CONTAINER_ID;
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

export function showToast(message, type = 'info') {
  const text = String(message || '').trim();
  if (!text) {
    return;
  }

  const container = getNotificationContainer();
  const toast = document.createElement('div');
  const normalizedType = ['success', 'warning', 'error', 'info'].includes(type) ? type : 'info';
  toast.className = `toast-message toast-message--${normalizedType}`;
  toast.setAttribute('role', normalizedType === 'error' ? 'alert' : 'status');

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
  window.setTimeout(() => removeToast(toast), GLOBAL_NOTIFICATION_TIMEOUT_MS);
}

function createConfirmModal() {
  const modal = document.createElement('div');
  modal.id = CONFIRM_MODAL_ID;
  modal.className = 'modal app-confirm-modal';
  modal.innerHTML = `
    <div class="modal-content app-confirm-modal__card" role="dialog" aria-modal="true" aria-labelledby="appConfirmTitle" aria-describedby="appConfirmDescription">
      <button class="favorite-modal__close app-confirm-modal__close" id="appConfirmClose" type="button" aria-label="Close dialog">×</button>
      <h2 id="appConfirmTitle">Confirm action</h2>
      <p id="appConfirmDescription" class="favorite-modal__intro">Please confirm this action.</p>
      <div class="favorite-modal__actions app-confirm-modal__actions">
        <button id="appConfirmCancel" type="button">Cancel</button>
        <button id="appConfirmSubmit" type="button">Confirm</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

export function showConfirmDialog(options = {}) {
  const modal = document.getElementById(CONFIRM_MODAL_ID) || createConfirmModal();
  const title = modal.querySelector('#appConfirmTitle');
  const description = modal.querySelector('#appConfirmDescription');
  const closeButton = modal.querySelector('#appConfirmClose');
  const cancelButton = modal.querySelector('#appConfirmCancel');
  const confirmButton = modal.querySelector('#appConfirmSubmit');
  const previousActiveElement = document.activeElement;

  title.textContent = options.title || 'Confirm action';
  description.textContent = options.description || 'Please confirm this action.';
  cancelButton.textContent = options.cancelLabel || 'Cancel';
  confirmButton.textContent = options.confirmLabel || 'Confirm';
  confirmButton.classList.toggle('button-danger', options.variant === 'danger');

  return new Promise((resolve) => {
    let resolved = false;

    const cleanup = () => {
      modal.style.display = 'none';
      modal.removeEventListener('click', handleBackdropClick);
      document.removeEventListener('keydown', handleKeydown);
      closeButton.onclick = null;
      cancelButton.onclick = null;
      confirmButton.onclick = null;
      previousActiveElement?.focus?.();
    };

    const finish = (value) => {
      if (resolved) {
        return;
      }
      resolved = true;
      cleanup();
      resolve(value);
    };

    const handleBackdropClick = (event) => {
      if (event.target === modal) {
        finish(false);
      }
    };

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    };

    closeButton.onclick = () => finish(false);
    cancelButton.onclick = () => finish(false);
    confirmButton.onclick = () => finish(true);
    modal.addEventListener('click', handleBackdropClick);
    document.addEventListener('keydown', handleKeydown);
    modal.style.display = 'flex';
    confirmButton.focus();
  });
}
