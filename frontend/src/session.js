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
