# Personalized Tourist Guide AI

Personalized Tourist Guide AI is a full-stack travel planning application for creating personalised itineraries from a destination, available time and travel preferences. Users can generate route suggestions, review recommended stops, use an interactive Google Maps layer when configured, save routes and continue planning later.

The product is designed as a clean public repository: the UI is user-facing, the configuration is environment-based and optional external providers degrade to safe local fallbacks.

## Core features

- Public landing page with product-focused navigation.
- Account creation and local sign-in.
- Authenticated dashboard with recent routes, recent searches and active preferences.
- Trip planner with country, city, interest and duration filters.
- Preference-aware local recommendation engine.
- Optional Google Maps, Google Routes and Google Places integrations.
- Saved routes library with search, sorting, details and remove actions.
- Route detail page with itinerary timeline, map fallback and export actions.
- User profile and travel preferences editor.
- Safe profile image upload with size/type validation.
- Runtime validation with Zod.
- Unit tests with Vitest and browser-flow tests with Playwright.
- Docker Compose setup for frontend, backend and PostgreSQL/PostGIS.

## Stack

### Frontend

- HTML
- CSS with custom design tokens, source styles and generated `public/app.css`
- JavaScript
- Rollup
- Google Maps JavaScript API when configured

### Backend

- Node.js
- Express
- Passport
- Sequelize
- PostgreSQL/PostGIS
- Zod
- Multer

### Optional providers

- Local recommendation engine by default
- Optional OpenAI provider for live itinerary generation
- Optional Google Maps, Routes and Places adapters

## Repository structure

```text
.
├── backend/                 # Express API, models, routes, services and validation schemas
├── frontend/                # Static pages, Rollup entries, generated app.css and public assets
├── scripts/                 # Local verification and release checks
├── tests/                   # Vitest unit tests and Playwright end-to-end tests
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```

## Environment setup

Copy the example file and create your local environment file:

```bash
copy .env.example .env
```

On macOS/Linux, use:

```bash
cp .env.example .env
```

Edit `.env` with your local values. Never commit a real `.env` file.

Key values:

```env
FRONTEND_URL=http://localhost:8080
FRONTEND_API_BASE_URL=http://localhost:5000
CORS_ORIGINS=http://localhost:8080
SESSION_SECRET=replace_with_a_long_random_value
DB_HOST=db
DB_PORT=5432
DB_NAME=tourist_guide
DB_USER=postgres
DB_PASSWORD=postgres
TRAVEL_AI_PROVIDER=openai
GOOGLE_MAPS_BROWSER_API_KEY=
GOOGLE_MAPS_SERVER_API_KEY=
GOOGLE_ROUTES_API_KEY=
GOOGLE_PLACES_API_KEY=
GOOGLE_PLACES_ENRICH_ITINERARIES=true
```

Google keys are optional for local development. When they are not configured, the app keeps the itinerary available as a list and uses local fallback data where possible.

## Run with Docker Compose

From the project root:

```bash
docker compose up --build
```

Default local URLs:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:5000`
- PostgreSQL/PostGIS host port: `5434`

Stop containers:

```bash
docker compose down
```

Reset local containers and database volumes only when you intentionally want a clean database:

```bash
docker compose down -v
docker compose up --build
```

## Run without Docker

Install all workspace dependencies from the project root:

```bash
npm install
```

Build frontend bundles:

```bash
npm run build:frontend
```

Start backend:

```bash
npm run start:backend
```

Start frontend in another terminal:

```bash
npm run start:frontend
```

## Database synchronisation

The backend runs the database synchronisation step before starting in Docker. To run it manually:

```bash
npm run db:sync
```

For an existing local PostgreSQL database, the sync step also checks the active `Users` table and adds missing compatibility columns such as `travel_preferences`, `profileImage` and `google_id` when needed.

For controlled local schema updates, set this value before syncing:

```env
DB_SYNC_ALTER=true
```

`DB_SYNC_ALTER=true` is blocked in production.

## Testing and verification

Syntax checks:

```bash
npm run check
```

Unit tests:

```bash
npm run test:unit
```

Playwright browser tests:

```bash
npx playwright install
npm run test:e2e
```

Smoke test against a running local stack:

```bash
npm run smoke:test
```

Security and release checks:

```bash
npm run security:scan
npm run release:audit
npm run check:release
```

## Optional Google configuration

### Google Maps JavaScript API

Used by the browser map layer.

```env
GOOGLE_MAPS_BROWSER_API_KEY=your_restricted_browser_key
```

Recommended APIs: Maps JavaScript API and Places API for browser-side place suggestions.

### Google server-side key

Used by backend geocoding helpers.

```env
GOOGLE_MAPS_SERVER_API_KEY=your_restricted_server_key
```

Recommended API: Geocoding API.

### Google Routes API

Used as an optional backend adapter for distance, duration and route metadata during itinerary generation and route rebuilds.

```env
GOOGLE_ROUTES_API_KEY=your_restricted_routes_key
GOOGLE_ROUTES_TIMEOUT_MS=8000
```

### Google Places API

Used as an optional backend adapter for real stop search, itinerary enrichment, addresses, ratings and coordinates.

```env
GOOGLE_PLACES_API_KEY=your_restricted_places_key
GOOGLE_PLACES_TIMEOUT_MS=8000
GOOGLE_PLACES_LANGUAGE_CODE=en
GOOGLE_PLACES_ENRICH_ITINERARIES=true
GOOGLE_PLACES_ENRICHMENT_LIMIT=12
```

Keep browser keys restricted by HTTP referrer. Keep server keys restricted by API scope and environment; do not paste real keys into commits or screenshots.

## Optional AI providers

The app can run with the local recommendation engine or with OpenAI as the live itinerary generator.

```env
TRAVEL_AI_PROVIDER=openai
AI_PROVIDER_TIMEOUT_MS=60000
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5.4-mini
```

The OpenAI integration uses the Responses API with Structured Outputs so generated itineraries follow the backend schema before they are enriched with Google Places and Google Routes. The generated payload includes day summaries, activity periods, visit durations, `placeQuery` and `mapsSearchHint` fields for better Google Places matching.

When `OPENAI_API_KEY` is empty, invalid or unavailable, the backend automatically uses the local fallback route generator so the UI remains testable without spending API credits.

External providers are optional. Do not commit provider credentials.

## Public release safety

Before publishing:

- confirm `.env` is not committed;
- keep `backend/uploads/` as runtime-only storage;
- restrict all API keys;
- run `npm run check:release`;
- review the public UI for user-facing copy only;
- verify account creation, sign-in, planning, saved routes and profile editing manually.

## Authors

See [AUTHORS.md](AUTHORS.md).

## License

This project is released under the MIT License. See [LICENSE](LICENSE).
