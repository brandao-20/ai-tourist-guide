(function () {
  function updateNavigationSurface() {
    const header = document.querySelector('.site-header');
    const navbar = document.querySelector('.navbar');
    if (!header || !navbar) return;

    const rect = navbar.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
    const y = Math.min(window.innerHeight - 1, Math.max(0, rect.bottom + 8));
    const element = document.elementFromPoint(x, y);
    const darkSurface = element?.closest?.('.hero-section, .welcome-panel, .profile-hero, .auth-intro, .page-hero, .classic-hero--dark, .dark-surface');

    header.classList.toggle('is-over-dark', Boolean(darkSurface));
    header.classList.toggle('is-over-light', !darkSurface);
  }

  window.addEventListener('scroll', updateNavigationSurface, { passive: true });
  window.addEventListener('resize', updateNavigationSurface);
  document.addEventListener('DOMContentLoaded', updateNavigationSurface);
  window.setTimeout(updateNavigationSurface, 200);
}());
