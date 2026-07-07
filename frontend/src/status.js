import { apiGet } from './api.js';
import { clearStatusMessage, getErrorMessage, setButtonBusy, setStatusMessage } from './ui.js';

function getElement(id) {
  return document.getElementById(id);
}

function createDetail(label, value) {
  const wrapper = document.createElement('div');
  wrapper.className = 'status-detail';

  const term = document.createElement('dt');
  term.textContent = label;

  const description = document.createElement('dd');
  description.textContent = value;

  wrapper.appendChild(term);
  wrapper.appendChild(description);
  return wrapper;
}

function createStatusCard({ title, state, description, details = [] }) {
  const card = document.createElement('article');
  card.className = 'status-card';
  card.dataset.state = state;

  const badge = document.createElement('span');
  badge.className = 'status-badge';
  badge.textContent = state;

  const heading = document.createElement('h3');
  heading.textContent = title;

  const text = document.createElement('p');
  text.textContent = description;

  const detailList = document.createElement('dl');
  detailList.className = 'status-details';
  details.forEach((detail) => {
    detailList.appendChild(createDetail(detail.label, detail.value));
  });

  card.appendChild(badge);
  card.appendChild(heading);
  card.appendChild(text);
  if (details.length > 0) {
    card.appendChild(detailList);
  }

  return card;
}

function formatBoolean(value) {
  return value ? 'Enabled' : 'Disabled';
}

function hasConfiguredBrowserMapKey() {
  const value = window.APP_CONFIG?.GOOGLE_MAPS_BROWSER_API_KEY;
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return Boolean(normalized) && ![
    'your_google_maps_browser_api_key',
    'replace_with_google_maps_browser_api_key',
    'change_me_google_maps_browser_api_key',
  ].includes(normalized);
}

function getFrontendCard() {
  const browserMapsConfigured = hasConfiguredBrowserMapKey();

  return createStatusCard({
    title: 'Frontend',
    state: browserMapsConfigured ? 'ok' : 'warning',
    description: browserMapsConfigured
      ? 'The static frontend is served and the Google Maps browser key is configured.'
      : 'The static frontend is served, but route planning is blocked until the Google Maps browser key is configured.',
    details: [
      { label: 'Runtime config', value: window.APP_CONFIG ? 'Loaded' : 'Using defaults' },
      { label: 'Google Maps browser key', value: browserMapsConfigured ? 'Configured' : 'Missing' },
    ],
  });
}

function getBackendHealthCard(health) {
  return createStatusCard({
    title: 'Backend API',
    state: health?.status === 'ok' ? 'ok' : 'warning',
    description: health?.status === 'ok'
      ? 'The API process is responding.'
      : 'The API returned an unexpected health response.',
    details: [
      { label: 'Service', value: health?.service || 'Unknown' },
      { label: 'Environment', value: health?.environment || 'Unknown' },
      { label: 'Uptime', value: Number.isFinite(health?.uptimeSeconds) ? `${health.uptimeSeconds}s` : 'Unknown' },
    ],
  });
}

function getReadinessCard(status) {
  const databaseStatus = status?.checks?.database?.status || 'unknown';
  const googleMapsServerKeyStatus = status?.checks?.googleMapsServerKey?.status || 'unknown';

  return createStatusCard({
    title: 'Readiness',
    state: status?.status === 'ready' ? 'ok' : 'warning',
    description: status?.status === 'ready'
      ? 'The API reports that required runtime checks are ready.'
      : 'The API is reachable, but at least one runtime dependency is unavailable.',
    details: [
      { label: 'API status', value: status?.status || 'Unknown' },
      { label: 'Database', value: databaseStatus },
      { label: 'Google Maps server key', value: googleMapsServerKeyStatus },
    ],
  });
}

function getCapabilitiesCard(capabilities) {
  const publicCapabilities = capabilities?.capabilities || {};

  return createStatusCard({
    title: 'Public capabilities',
    state: 'info',
    description: 'Feature flags exposed by the backend for the public frontend.',
    details: [
      { label: 'Local auth', value: formatBoolean(publicCapabilities.auth?.local) },
      { label: 'Google OAuth', value: formatBoolean(publicCapabilities.auth?.googleOAuth) },
      { label: 'AI provider', value: publicCapabilities.ai?.provider || 'Unknown' },
      { label: 'Google Maps required', value: formatBoolean(publicCapabilities.maps?.required) },
      { label: 'Server geocoding', value: formatBoolean(publicCapabilities.maps?.serverGeocoding) },
      { label: 'Route planning', value: publicCapabilities.maps?.routePlanning || 'Unknown' },
    ],
  });
}

function getUnavailableBackendCard(error) {
  return createStatusCard({
    title: 'Backend API',
    state: 'error',
    description: getErrorMessage(error, 'The API could not be reached from the browser.'),
    details: [
      { label: 'Suggestion', value: 'Start the backend, check API_BASE_URL in config.js and retry.' },
    ],
  });
}

function renderCards(cards) {
  const grid = getElement('status-grid');
  if (!grid) {
    return;
  }

  grid.innerHTML = '';
  cards.forEach((card) => grid.appendChild(card));
}

async function loadStatus() {
  const summary = getElement('status-summary');
  const feedback = getElement('status-feedback');
  const refreshButton = getElement('refresh-status');
  const restoreButton = setButtonBusy(refreshButton, 'Checking...');

  clearStatusMessage(feedback);
  if (summary) {
    summary.textContent = 'Checking frontend and backend availability...';
  }

  const cards = [getFrontendCard()];

  try {
    const [health, capabilities, status] = await Promise.all([
      apiGet('/health'),
      apiGet('/capabilities'),
      apiGet('/status').catch((error) => error),
    ]);

    cards.push(getBackendHealthCard(health));
    cards.push(getCapabilitiesCard(capabilities));

    if (status instanceof Error) {
      cards.push(getReadinessCard(status.data || { status: 'degraded' }));
      setStatusMessage(feedback, 'The backend is reachable, but readiness checks are degraded.', 'warning');
    } else {
      cards.push(getReadinessCard(status));
      setStatusMessage(feedback, 'Application status loaded successfully.', 'success');
    }

    if (summary) {
      summary.textContent = status instanceof Error
        ? 'Frontend and backend are reachable, but one dependency needs attention.'
        : 'Frontend and backend are reachable.';
    }
  } catch (error) {
    cards.push(getUnavailableBackendCard(error));
    setStatusMessage(feedback, getErrorMessage(error, 'Could not reach the API.'), 'error');
    if (summary) {
      summary.textContent = 'Frontend is available, but the backend could not be reached.';
    }
  } finally {
    renderCards(cards);
    restoreButton();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  getElement('refresh-status')?.addEventListener('click', loadStatus);
  loadStatus();
});
