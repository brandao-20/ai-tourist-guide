import { getApiUrl } from './config.js';

export function setupLogoutButton(selector = '.logout-btn, [data-logout-link]') {
  const logoutUrl = getApiUrl('/logout');

  const bindLogoutLinks = () => {
    document.querySelectorAll(selector).forEach((control) => {
      if (control.dataset.logoutBound === 'true') {
        return;
      }

      control.dataset.logoutBound = 'true';

      if (control.tagName === 'A') {
        control.href = logoutUrl;
      }

      control.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.assign(logoutUrl);
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindLogoutLinks, { once: true });
    return;
  }

  bindLogoutLinks();
}

export async function getCurrentSessionUser() {
  try {
    const response = await fetch(getApiUrl('/api/user'), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    return null;
  }
}

export async function requireAuthenticatedSession({ redirectTo = '/login', next = window.location.pathname } = {}) {
  const user = await getCurrentSessionUser();

  if (user) {
    return user;
  }

  const target = new URL(redirectTo, window.location.origin);
  target.searchParams.set('next', next || window.location.pathname);
  window.location.replace(target.pathname + target.search);
  return null;
}

