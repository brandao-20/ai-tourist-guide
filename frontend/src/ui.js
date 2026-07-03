export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function stripHtml(value = '') {
  return String(value)
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
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="text-align: center;">
      <span class="close-button" id="favoriteModalClose" aria-label="Close">&times;</span>
      <h2 style="color: #344e41;">Save Favorite Itinerary</h2>
      <input type="text" id="favoriteNameInput" maxlength="120" placeholder="Enter a name for the itinerary" style="padding:10px; width:80%; border:1px solid #ccc; border-radius:4px; margin:10px 0;">
      <div>
        <button id="favoriteModalSave" type="button" style="background-color: #344e41; color:#fff; padding:10px 20px; border:none; border-radius:4px; cursor:pointer; margin-right:10px;">Save</button>
        <button id="favoriteModalCancel" type="button" style="background-color: #ff4d4d; color:#fff; padding:10px 20px; border:none; border-radius:4px; cursor:pointer;">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  return modal;
}

export function showFavoriteNameModal(callback) {
  const modal = document.getElementById('favoriteModal') || createFavoriteNameModal();
  const input = modal.querySelector('#favoriteNameInput');
  const closeButton = modal.querySelector('#favoriteModalClose');
  const cancelButton = modal.querySelector('#favoriteModalCancel');
  const saveButton = modal.querySelector('#favoriteModalSave');

  const closeModal = () => {
    modal.style.display = 'none';
  };

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

  input.value = '';
  modal.style.display = 'block';
  input.focus();
}
