import { formatDateTime, formatDistance, formatDuration } from './formatters.js';
import { escapeHtml, stripHtml } from './ui.js';

function normalizeText(value, fallback = 'Not available') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function safeFileName(value, fallback = 'saved-route') {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function getItinerary(routeDetails = {}) {
  return routeDetails.itinerary || {};
}

function getMonuments(routeDetails = {}) {
  const monuments = getItinerary(routeDetails).monuments;
  return Array.isArray(monuments) ? monuments : [];
}

function getDays(routeDetails = {}) {
  const days = getItinerary(routeDetails).days;
  return Array.isArray(days) ? days : [];
}

function getLegs(routeDetails = {}) {
  const legs = routeDetails?.map_data?.routes?.[0]?.legs;
  if (Array.isArray(legs)) {
    return legs;
  }

  const metadataLegs = routeDetails?.map_data?.routeMetadata?.legs;
  return Array.isArray(metadataLegs) ? metadataLegs : [];
}

function getMetricValue(metric) {
  return typeof metric?.value === 'number' && Number.isFinite(metric.value) ? metric.value : 0;
}

function summarizeLegs(legs, routeDetails = {}) {
  const routeMetadata = routeDetails?.map_data?.routeMetadata || null;
  if (routeMetadata?.distanceMeters || routeMetadata?.durationSeconds) {
    return {
      distanceMeters: Number(routeMetadata.distanceMeters) || 0,
      durationSeconds: Number(routeMetadata.durationSeconds) || 0,
    };
  }

  return legs.reduce(
    (summary, leg) => ({
      distanceMeters: summary.distanceMeters + getMetricValue(leg.distance),
      durationSeconds: summary.durationSeconds + getMetricValue(leg.duration),
    }),
    { distanceMeters: 0, durationSeconds: 0 }
  );
}

function getRouteName(routeDetails = {}) {
  return normalizeText(routeDetails.name || getItinerary(routeDetails).name, 'Saved route');
}

function getStopAddress(monument = {}) {
  return normalizeText(monument.address || monument.location || monument.city, 'Address unavailable');
}

function getTravelMode(routeDetails = {}) {
  const travelMode = routeDetails?.map_data?.request?.travelMode || routeDetails?.map_data?.routeMetadata?.travelMode;
  return normalizeText(String(travelMode || '').toLowerCase(), 'driving');
}

export function createGoogleMapsDirectionsUrl(monuments = []) {
  const stops = monuments
    .map((monument) => monument?.address || monument?.name)
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  if (stops.length < 2) return null;

  const params = new URLSearchParams({
    api: '1',
    origin: stops[0],
    destination: stops[stops.length - 1],
    travelmode: 'driving',
  });

  const waypoints = stops.slice(1, -1);
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.slice(0, 9).join('|'));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function createRouteExportModel(routeDetails = {}, mapsUrl = null) {
  const monuments = getMonuments(routeDetails);
  const legs = getLegs(routeDetails);
  const days = getDays(routeDetails);
  const totals = summarizeLegs(legs, routeDetails);
  const googleMapsUrl = mapsUrl || createGoogleMapsDirectionsUrl(monuments);

  return {
    name: getRouteName(routeDetails),
    savedAt: routeDetails.createdAt || null,
    updatedAt: routeDetails.updatedAt || null,
    generatedAt: new Date().toISOString(),
    summary: {
      stops: monuments.length,
      days: days.length || Number(getItinerary(routeDetails).durationDays || 0) || null,
      legs: legs.length,
      distance: formatDistance(totals.distanceMeters, 'Not available'),
      distanceMeters: totals.distanceMeters,
      duration: formatDuration(totals.durationSeconds, 'Not available'),
      durationSeconds: totals.durationSeconds,
      travelMode: getTravelMode(routeDetails),
      googleMapsUrl,
    },
    stops: monuments.map((monument, index) => ({
      order: index + 1,
      name: normalizeText(monument.name, `Stop ${index + 1}`),
      address: getStopAddress(monument),
      city: normalizeText(monument.city, ''),
      country: normalizeText(monument.country, ''),
      category: normalizeText(monument.category, ''),
      placeQuery: normalizeText(monument.placeQuery || monument.mapsSearchHint, ''),
      mapsSearchHint: normalizeText(monument.mapsSearchHint || monument.placeQuery, ''),
      tags: Array.isArray(monument.tags) ? monument.tags.filter(Boolean) : [],
      durationMinutes: Number.isFinite(Number(monument.durationMinutes)) ? Number(monument.durationMinutes) : null,
      reason: normalizeText(monument.reason || monument.explanation || monument.description, ''),
      coordinates: monument.coordinates || null,
    })),
    legs: legs.map((leg, index) => ({
      order: index + 1,
      from: normalizeText(leg.start_address, `Leg ${index + 1} origin`),
      to: normalizeText(leg.end_address, `Leg ${index + 1} destination`),
      distance: normalizeText(leg.distance?.text, 'Not available'),
      duration: normalizeText(leg.duration?.text, 'Not available'),
      steps: Array.isArray(leg.steps)
        ? leg.steps.map((step) => stripHtml(step.instructions || '')).filter(Boolean)
        : [],
    })),
  };
}

function createMetaRow(label, value) {
  return `<div class="meta-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function createStopHtml(stop) {
  const tags = [...new Set([stop.category, ...stop.tags].filter(Boolean))]
    .slice(0, 4)
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join('');

  const coordinates = stop.coordinates?.lat && stop.coordinates?.lng
    ? `<p class="muted">${escapeHtml(`${Number(stop.coordinates.lat).toFixed(5)}, ${Number(stop.coordinates.lng).toFixed(5)}`)}</p>`
    : '';

  const duration = stop.durationMinutes ? `<p class="muted">Suggested visit: ${escapeHtml(`${stop.durationMinutes} min`)}</p>` : '';
  const reason = stop.reason ? `<p>${escapeHtml(stop.reason)}</p>` : '';

  return `
    <article class="stop-card">
      <span class="index">${String(stop.order).padStart(2, '0')}</span>
      <div>
        <h3>${escapeHtml(stop.name)}</h3>
        <p>${escapeHtml(stop.address)}</p>
        ${coordinates}
        ${duration}
        ${reason}
        ${tags ? `<div class="tags">${tags}</div>` : ''}
      </div>
    </article>
  `;
}

function createLegHtml(leg) {
  const steps = leg.steps.slice(0, 10).map((step) => `<li>${escapeHtml(step)}</li>`).join('');
  const hiddenSteps = leg.steps.length > 10 ? `<li>+${leg.steps.length - 10} additional instructions in Google Maps.</li>` : '';

  return `
    <article class="leg-card">
      <div class="leg-title">
        <span class="index">${String(leg.order).padStart(2, '0')}</span>
        <div>
          <h3>${escapeHtml(leg.from)} → ${escapeHtml(leg.to)}</h3>
          <p>${escapeHtml(leg.distance)} · ${escapeHtml(leg.duration)}</p>
        </div>
      </div>
      <ol>${steps || '<li>No turn-by-turn instructions stored for this leg.</li>'}${hiddenSteps}</ol>
    </article>
  `;
}

export function createRouteSummaryText(routeDetails = {}, mapsUrl = null) {
  const model = createRouteExportModel(routeDetails, mapsUrl);
  const stops = model.stops.map((stop) => `${stop.order}. ${stop.name} — ${stop.address}`).join('\n');
  const legs = model.legs
    .map((leg) => `${leg.order}. ${leg.from} → ${leg.to} (${leg.distance}, ${leg.duration})`)
    .join('\n');

  return [
    model.name,
    `Stops: ${model.summary.stops}`,
    `Days: ${model.summary.days || 'Not available'}`,
    `Distance: ${model.summary.distance}`,
    `Duration: ${model.summary.duration}`,
    `Google Maps: ${model.summary.googleMapsUrl || 'Not available'}`,
    '',
    'Stops:',
    stops || 'No stops available.',
    '',
    'Route legs:',
    legs || 'No route legs available.',
  ].join('\n');
}

export function createRouteExportHtml(routeDetails = {}, mapsUrl = null) {
  const model = createRouteExportModel(routeDetails, mapsUrl);
  const routeLink = model.summary.googleMapsUrl
    ? `<a class="maps-link" href="${escapeHtml(model.summary.googleMapsUrl)}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>`
    : '<span class="maps-link maps-link--disabled">Google Maps link unavailable</span>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(model.name)} - Route Export</title>
  <style>
    :root { color-scheme: light; --green: #344e41; --muted: #667367; --border: #d8e0d2; --soft: #f6f8f2; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef2ea; color: #24382e; font-family: Arial, sans-serif; line-height: 1.55; }
    main { width: min(980px, calc(100% - 32px)); margin: 28px auto; padding: clamp(22px, 4vw, 42px); border-radius: 28px; background: #fff; box-shadow: 0 24px 60px rgba(25,45,34,.12); }
    header { border-radius: 24px; padding: clamp(24px, 5vw, 42px); background: linear-gradient(135deg, var(--green), #3a5a40); color: #fff; }
    .eyebrow { margin: 0 0 8px; text-transform: uppercase; letter-spacing: .14em; font-size: .72rem; font-weight: 800; opacity: .78; }
    h1 { margin: 0; font-size: clamp(2rem, 6vw, 4rem); line-height: .95; letter-spacing: -.05em; }
    h2 { margin: 32px 0 14px; color: var(--green); }
    a { color: var(--green); font-weight: 800; }
    .maps-link { display: inline-flex; align-items: center; margin-left: 8px; padding: 7px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.38); background: rgba(255,255,255,.16); color: #fff; text-decoration: none; box-shadow: inset 0 0 0 1px rgba(255,255,255,.06); }
    .maps-link:hover { background: rgba(255,255,255,.24); color: #fff; }
    .maps-link--disabled { opacity: .76; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
    .meta-card, .stop-card, .leg-card { border: 1px solid var(--border); border-radius: 18px; background: var(--soft); }
    .meta-card { padding: 16px; }
    .meta-card span, .muted { color: var(--muted); }
    .meta-card span { display: block; margin-bottom: 6px; font-size: .72rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
    .meta-card strong { font-size: 1.25rem; }
    .stop-card, .leg-card { display: flex; gap: 14px; margin: 12px 0; padding: 16px; page-break-inside: avoid; }
    .index { flex: 0 0 auto; display: grid; width: 36px; height: 36px; place-items: center; border-radius: 12px; background: rgba(52,78,65,.1); color: var(--green); font-weight: 900; }
    h3 { margin: 0 0 6px; color: var(--green); }
    p { margin: 0 0 8px; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .tags span { padding: 5px 9px; border-radius: 999px; background: #fff; color: var(--muted); font-size: .78rem; font-weight: 800; }
    .leg-card { display: grid; }
    .leg-title { display: flex; gap: 14px; }
    ol { margin: 10px 0 0; padding-left: 24px; }
    footer { margin-top: 32px; padding-top: 18px; border-top: 1px solid var(--border); color: var(--muted); font-size: .9rem; }
    @media (max-width: 720px) { .meta-grid { grid-template-columns: 1fr 1fr; } main { width: min(100% - 18px, 980px); } }
    @media print { body { background: #fff; } main { width: auto; margin: 0; padding: 0; box-shadow: none; } header { color: #24382e; background: #fff; border: 1px solid var(--border); } }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">Saved itinerary export</p>
      <h1>${escapeHtml(model.name)}</h1>
      <p>Generated ${escapeHtml(formatDateTime(model.generatedAt))}. ${routeLink}</p>
    </header>

    <section class="meta-grid" aria-label="Route summary">
      ${createMetaRow('Stops', String(model.summary.stops))}
      ${createMetaRow('Days', model.summary.days ? String(model.summary.days) : 'N/A')}
      ${createMetaRow('Distance', model.summary.distance)}
      ${createMetaRow('Duration', model.summary.duration)}
    </section>

    <section>
      <h2>Stops</h2>
      ${model.stops.map(createStopHtml).join('') || '<p>No stops available.</p>'}
    </section>

    <section>
      <h2>Route legs</h2>
      ${model.legs.map(createLegHtml).join('') || '<p>No route legs available.</p>'}
    </section>

    <footer>
      <p>Exported from Personalized Tourist Guide AI. Review live traffic, opening hours and restrictions directly in Google Maps before travelling.</p>
      <p>Saved: ${escapeHtml(formatDateTime(model.savedAt))} · Updated: ${escapeHtml(formatDateTime(model.updatedAt))}</p>
    </footer>
  </main>
</body>
</html>`;
}

function downloadBlob(fileName, contents, mimeType) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadRouteJson(routeDetails = {}) {
  const fileName = `${safeFileName(getRouteName(routeDetails))}.json`;
  downloadBlob(fileName, JSON.stringify(routeDetails, null, 2), 'application/json');
}

export function downloadRouteHtml(routeDetails = {}, mapsUrl = null) {
  const fileName = `${safeFileName(getRouteName(routeDetails))}.html`;
  downloadBlob(fileName, createRouteExportHtml(routeDetails, mapsUrl), 'text/html;charset=utf-8');
}

export async function copyRouteSummary(routeDetails = {}, mapsUrl = null) {
  const text = createRouteSummaryText(routeDetails, mapsUrl);
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard API is not available in this browser.');
  }

  await navigator.clipboard.writeText(text);
}
