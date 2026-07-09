export function formatDate(value, fallback = 'Unknown', options = {}) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(date);
}

export function formatDateTime(value, fallback = 'Not available') {
  return formatDate(value, fallback, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDistance(meters, fallback = '—') {
  if (!meters) {
    return fallback;
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  const kilometers = meters / 1000;
  return `${kilometers.toFixed(kilometers >= 10 ? 0 : 1)} km`;
}

export function formatDuration(seconds, fallback = '—') {
  if (!seconds) {
    return fallback;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours <= 0) {
    return `${Math.max(minutes, 1)} min`;
  }

  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}
