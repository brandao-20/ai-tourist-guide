import { apiGet } from './api.js';
import { DEFAULT_AVATAR, getUploadUrl } from './config.js';
import { setStatusMessage } from './ui.js';
import { requireAuthenticatedSession, setupLogoutButton } from './session.js';
import { truncateText } from './routePresentation.js';

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function setProfileImage(user) {
  const profilePicture = document.getElementById('profile-pic');
  if (!profilePicture) {
    return;
  }

  const displayName = user.name || 'Traveller';
  profilePicture.src = user.profileImage ? getUploadUrl(user.profileImage) : DEFAULT_AVATAR;
  profilePicture.alt = `${displayName} profile picture`;
}

function updateUserProfile(user) {
  const statusElement = document.getElementById('profile-status');
  const displayName = user.name || 'Traveller';

  setText('user-name', displayName);
  setText('profile-name', displayName);
  setText('profile-email', user.email || 'Email not available');
  setProfileImage(user);
  setStatusMessage(statusElement, '', 'info');
}

function getFavoriteStops(favorite) {
  const monuments = favorite?.itinerary?.monuments;
  return Array.isArray(monuments) ? monuments.length : 0;
}

async function updateProfileStats() {
  try {
    const [favorites, recentSearch] = await Promise.all([
      apiGet('/favorites'),
      apiGet('/recent_search').catch(() => null),
    ]);

    const safeFavorites = Array.isArray(favorites) ? favorites : [];
    const totalStops = safeFavorites.reduce((sum, favorite) => sum + getFavoriteStops(favorite), 0);
    const latestFavorite = safeFavorites[0];
    const recentCities = Array.isArray(recentSearch?.query_params?.selectedCities)
      ? recentSearch.query_params.selectedCities.join(' → ')
      : '';
    const latestName = recentCities || latestFavorite?.name || 'No itinerary yet';

    setText('profile-routes-count', String(safeFavorites.length));
    setText('profile-stops-count', String(totalStops));
    setText('profile-latest-route', truncateText(latestName, 44));
  } catch (error) {
    setText('profile-routes-count', '—');
    setText('profile-stops-count', '—');
    setText('profile-latest-route', 'Unavailable');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  setupLogoutButton();
  const statusElement = document.getElementById('profile-status');
  setStatusMessage(statusElement, 'Loading profile...', 'info');

  const user = await requireAuthenticatedSession({ next: '/profile' });
  if (!user) {
    return;
  }

  updateUserProfile(user);
  updateProfileStats();
});
