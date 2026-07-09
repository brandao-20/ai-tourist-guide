function normalizePosition(position) {
  if (!position) {
    return null;
  }

  if (typeof position.lat === 'function' && typeof position.lng === 'function') {
    return { lat: position.lat(), lng: position.lng() };
  }

  const lat = Number(position.lat);
  const lng = Number(position.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function createMarkerElement({ label = '', title = '', variant = 'pin' } = {}) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `app-map-marker app-map-marker--${variant}`;
  element.setAttribute('aria-label', title || label || 'Map marker');
  element.title = title || label || '';

  if (label) {
    const labelElement = document.createElement('span');
    labelElement.className = 'app-map-marker__label';
    labelElement.textContent = String(label);
    element.appendChild(labelElement);
  }

  if (variant !== 'dot') {
    const tailElement = document.createElement('span');
    tailElement.className = 'app-map-marker__tail';
    tailElement.setAttribute('aria-hidden', 'true');
    element.appendChild(tailElement);
  }

  return element;
}

function createOverlayMarkerClass() {
  return class AppMapMarker extends google.maps.OverlayView {
    constructor({ position, map, title = '', label = '', variant = 'pin' } = {}) {
      super();
      this.position = normalizePosition(position);
      this.title = title;
      this.label = label;
      this.variant = variant;
      this.element = null;
      this.eventHandlers = [];

      if (map) {
        this.setMap(map);
      }
    }

    onAdd() {
      this.element = createMarkerElement({
        label: this.label,
        title: this.title,
        variant: this.variant,
      });

      const panes = this.getPanes();
      panes?.overlayMouseTarget?.appendChild(this.element);

      this.eventHandlers.forEach(({ eventName, handler }) => {
        this.element.addEventListener(eventName, handler);
      });
    }

    draw() {
      if (!this.element || !this.position) {
        return;
      }

      const projection = this.getProjection();
      if (!projection) {
        return;
      }

      const pixel = projection.fromLatLngToDivPixel(this.getPosition());
      if (!pixel) {
        return;
      }

      this.element.style.transform = `translate(${pixel.x}px, ${pixel.y}px) translate(-50%, -100%)`;
    }

    onRemove() {
      if (this.element) {
        this.eventHandlers.forEach(({ eventName, handler }) => {
          this.element.removeEventListener(eventName, handler);
        });
      }
      this.element?.remove();
      this.element = null;
    }

    getPosition() {
      if (!this.position) {
        return null;
      }

      return new google.maps.LatLng(this.position.lat, this.position.lng);
    }

    addListener(eventName, handler) {
      const listener = { eventName, handler: (event) => handler(event) };
      this.eventHandlers.push(listener);

      if (this.element) {
        this.element.addEventListener(eventName, listener.handler);
      }

      return {
        remove: () => {
          if (this.element) {
            this.element.removeEventListener(eventName, listener.handler);
          }
          this.eventHandlers = this.eventHandlers.filter((item) => item !== listener);
        },
      };
    }
  };
}

export function createMapMarker(options = {}) {
  if (!window.google?.maps?.OverlayView) {
    return null;
  }

  const OverlayMarker = createOverlayMarkerClass();
  return new OverlayMarker(options);
}

export function openMarkerInfoWindow(infoWindow, map, marker) {
  if (!infoWindow || !map || !marker) {
    return;
  }

  if (typeof marker.getPosition === 'function') {
    infoWindow.setPosition(marker.getPosition());
  }

  infoWindow.open({ map });
}
