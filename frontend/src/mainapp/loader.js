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
    @keyframes plannerPulse {
      0%, 100% { transform: scale(0.96); opacity: 0.75; }
      50% { transform: scale(1); opacity: 1; }
    }

    #${LOADER_ID} {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 3000;
      background: rgba(238, 242, 234, 0.72);
      backdrop-filter: blur(8px);
    }

    #${LOADER_ID} .loader-card {
      display: grid;
      justify-items: center;
      gap: 14px;
      width: min(340px, calc(100% - 48px));
      padding: 28px;
      border: 1px solid rgba(52, 78, 65, 0.14);
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 30px 90px rgba(25, 45, 34, 0.22);
      color: #344e41;
      text-align: center;
    }

    #${LOADER_ID} .loader-dot {
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: linear-gradient(135deg, #344e41, #a3b18a);
      box-shadow: 0 0 0 12px rgba(163, 177, 138, 0.18);
      animation: plannerPulse 1.2s ease-in-out infinite;
    }

    #${LOADER_ID} strong {
      display: block;
      font-size: 1.05rem;
    }

    #${LOADER_ID} span {
      color: #667367;
      line-height: 1.5;
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
  loader.setAttribute('aria-live', 'polite');
  loader.setAttribute('aria-label', 'Generating itinerary');
  loader.innerHTML = `
    <div class="loader-card">
      <div class="loader-dot" aria-hidden="true"></div>
      <div>
        <strong>Generating itinerary</strong>
        <span>Preparing stops, route data and route suggestions.</span>
      </div>
    </div>
  `;
  document.body.appendChild(loader);

  return loader;
}

export function showLoadingIndicator() {
  const loader = ensureLoader();
  loader.style.display = 'flex';
}

export function hideLoadingIndicator() {
  const loader = document.getElementById(LOADER_ID);
  if (loader) {
    loader.style.display = 'none';
  }
}
