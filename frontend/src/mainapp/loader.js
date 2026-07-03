const LOADER_ID = 'loader';
const LOADER_STYLE_ID = 'loader-style';

function ensureLoaderStyle() {
  if (document.getElementById(LOADER_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = LOADER_STYLE_ID;
  style.type = 'text/css';
  style.innerHTML = `
    @keyframes spin {
      0% { transform: translate(-50%, -50%) rotate(0deg); }
      100% { transform: translate(-50%, -50%) rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

function ensureLoader() {
  let loader = document.getElementById(LOADER_ID);
  if (loader) {
    return loader;
  }

  ensureLoaderStyle();

  loader = document.createElement('div');
  loader.id = LOADER_ID;
  loader.setAttribute('role', 'status');
  loader.setAttribute('aria-label', 'Loading');
  loader.style.position = 'fixed';
  loader.style.left = '50%';
  loader.style.top = '50%';
  loader.style.transform = 'translate(-50%, -50%)';
  loader.style.border = '16px solid #f3f3f3';
  loader.style.borderTop = '16px solid #3498db';
  loader.style.borderRadius = '50%';
  loader.style.width = '120px';
  loader.style.height = '120px';
  loader.style.animation = 'spin 2s linear infinite';
  loader.style.zIndex = '2000';
  document.body.appendChild(loader);

  return loader;
}

export function showLoadingIndicator() {
  const loader = ensureLoader();
  loader.style.display = 'block';
}

export function hideLoadingIndicator() {
  const loader = document.getElementById(LOADER_ID);
  if (loader) {
    loader.style.display = 'none';
  }
}
