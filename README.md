# Personalized Tourist Guide AI

Portfolio-ready version of an academic web application for personalized tourist recommendations, interactive map exploration and AI-assisted itinerary planning.

The project combines a static JavaScript/Rollup frontend, a Node.js/Express backend, PostgreSQL/PostGIS storage, Google Maps integration and a configurable AI layer that can run in **mock**, **local model/Ollama** or **OpenAI** mode.

> This repository is a cleaned and restructured version of the original academic project, prepared for public portfolio usage. Sensitive data, hardcoded API keys, personal uploads and private contact details were removed.

## Features

- User registration and login with centralized input validation and safe session responses.
- Optional Google OAuth authentication without storing provider tokens; the frontend detects when it is unavailable and keeps local login usable.
- Interactive Google Maps-based exploration.
- Country/city filtering using a local cities dataset, without a browser dependency on external country APIs.
- Personalized travel search with itinerary generation.
- Configurable AI provider:
  - `mock` for free local testing without API costs;
  - `ollama` for local LLM inference;
  - `openai` for API-based generation if explicitly configured.
- Optional Google Geocoding support for itinerary places, with server-side timeout and sanitized error logging.
- Favourite itinerary saving with sanitized public responses.
- Recent search persistence with server-side JSON payload validation.
- User profile editing and safe profile image upload with stale upload cleanup.
- Docker Compose setup with PostgreSQL/PostGIS, backend and frontend services.
- Safe API health/status/capabilities endpoints for local checks, Docker readiness and frontend feature detection.
- Lightweight frontend static server with a `/health` endpoint, custom 404 page and public status page.

## Tech Stack

### Frontend

- JavaScript
- HTML/CSS
- Rollup
- Native Fetch API
- Google Maps JavaScript API

### Backend

- Node.js
- Express.js
- Passport.js
- Sequelize
- PostgreSQL/PostGIS
- Multer
- Google Geocoding API

### AI / Recommendation Layer

- Mock provider for deterministic local demos
- Ollama-compatible local model provider
- Optional OpenAI provider

### DevOps / Tooling

- Docker
- Docker Compose
- Git/GitHub
- Environment-based configuration

## Repository Structure

```text
.
├── backend/                 # Express API, authentication, AI provider and persistence
│   ├── config/              # Centralized environment and database configuration
│   ├── data/
│   ├── middleware/          # Authenticated-user resolution and safe uploads
│   ├── models/             # Sequelize models for users, favourites and recent searches
│   ├── routes/
│   ├── scripts/
│   ├── services/           # AI, geocoding, city catalog, health, profile and persisted itinerary services
│   └── server.js
├── frontend/                # Static JavaScript/Rollup frontend and public pages
│   ├── public/              # HTML, CSS, assets and runtime browser config
│   ├── src/                 # Page-specific JavaScript bundles
│   └── server.js            # Minimal static server with /health and 404 handling
├── package.json             # Root convenience scripts only
├── docker-compose.yml
├── .env.example
├── AUTHORS.md
└── README.md
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/brandao-20/personalized-tourist-guide-ai.git
cd personalized-tourist-guide-ai
```

### 2. Configure environment variables

Create a local `.env` file:

```bash
cp .env.example .env
```

Update values as needed. Runtime settings are read centrally from `backend/config/env.js`; the backend loads the root `.env` file, including CORS origins, session cookies, database settings, AI provider settings and external API timeouts. The default AI provider is `mock`, so the application can be tested without paid AI APIs. Country and city dropdowns are served from `backend/data/cities.json`, so the main search form does not depend on the Rest Countries API.

Useful local defaults:

```env
FRONTEND_URL=http://localhost:8080
CORS_ORIGINS=http://localhost:8080
JSON_BODY_LIMIT=10mb
HEALTHCHECK_TIMEOUT_MS=3000
SESSION_COOKIE_SAMESITE=lax
DATABASE_URL=
```

For production-like deployments, `DATABASE_URL` can be used instead of the individual `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` and `DB_NAME` values.

### 3. Configure frontend runtime settings

Edit `frontend/public/config.js`:

```js
window.APP_CONFIG = {
  API_BASE_URL: 'http://localhost:5000',
  GOOGLE_MAPS_BROWSER_API_KEY: 'your_restricted_browser_key',
};
```

For public repositories, never commit real API keys. Browser keys should be restricted in Google Cloud by HTTP referrer and API scope.

The backend can optionally use `GOOGLE_MAPS_SERVER_API_KEY` for server-side geocoding. If it is empty, itinerary generation still works, but returned monuments may not have coordinates until manually adjusted in the UI.

### 4. Install dependencies for local development

If you want to run the backend/frontend directly on the host machine, install each package independently:

```bash
npm run install:all
```

The root package does not contain runtime dependencies; it only exposes convenience scripts for the backend and frontend packages.

### 5. Run with Docker Compose

```bash
docker compose up --build
```

Default local services:

- Frontend: `http://localhost:8080`
- Frontend health: `http://localhost:8080/health`
- Frontend public status page: `http://localhost:8080/status.html`
- Backend API: `http://localhost:5000`
- PostgreSQL/PostGIS: host port `5434`

Docker Compose waits for PostgreSQL to become healthy before starting the backend, waits for the backend health endpoint before starting the frontend, and checks the frontend through its own `/health` endpoint.

Safe API checks:

- `GET /health` on the frontend confirms that the static demo server is alive.
- `GET /api/health` confirms that the API process is alive.
- `GET /api/capabilities` reports public feature flags such as local auth, Google OAuth availability, AI provider and geocoding mode without checking the database.
- `GET /api/status` checks database readiness and reports the same public capability flags, without exposing secrets or raw external provider responses.

### 6. Run syntax checks

```bash
npm run check
```

This validates the main backend and frontend JavaScript files without requiring production secrets.

### 7. Synchronize database tables

If you are using Docker Compose:

```bash
docker compose exec backend npm run db:sync
```

If you are running the backend directly on the host machine after `npm run install:all`:

```bash
npm run db:sync
```

For first-time local/demo setup, `db:sync` creates the Sequelize model tables directly. This repository intentionally does not keep partial Sequelize CLI migration/config artefacts from the old academic project.

For development schema updates only, set this in `.env` before running the sync command:

```env
DB_SYNC_ALTER=true
```

`DB_SYNC_ALTER=true` is blocked when `NODE_ENV=production` so public/hosted deployments do not accidentally mutate schemas at runtime.

## AI Provider Configuration

The backend uses `TRAVEL_AI_PROVIDER` to choose the itinerary generation provider. Provider responses are parsed and normalized before reaching the frontend; raw provider output is not exposed by the API. Saved itineraries and recent searches are also serialized through backend services so database-only fields such as `user_id` are not returned to the browser.

Optional timeout settings:

```env
AI_PROVIDER_TIMEOUT_MS=20000
GEOCODING_TIMEOUT_MS=7000
```

### Mock mode

```env
TRAVEL_AI_PROVIDER=mock
```

Best for portfolio demos, screenshots and local development without API costs.

### Local model mode with Ollama

```env
TRAVEL_AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

Run Ollama locally and pull a model, for example:

```bash
ollama pull llama3.1:8b
```

This is the preferred direction for a more personal and cost-controlled version of the project.

### OpenAI mode

```env
TRAVEL_AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

Use only when explicitly needed.


## Public Safety Notes

- Do not commit a real `.env` file, API keys, OAuth secrets or database passwords.
- `backend/uploads/` should only keep `.gitkeep`; uploaded profile images are runtime files and are ignored by Git/Docker.
- Profile image uploads are limited to JPEG, PNG, WebP and GIF files up to 2 MB. Replacing a profile image removes the previous stored upload when it belongs to the managed uploads folder.
- Session responses use a small public user shape only: `id`, `name`, `email` and `profileImage`.
- Runtime configuration is centralized in `backend/config/env.js`, avoiding scattered environment parsing and unsafe fallbacks.
- Health/status/capabilities responses expose only safe operational metadata and public feature flags, never environment secrets or raw error objects.
- The public `/status.html` page consumes those safe endpoints and helps diagnose missing backend/configuration during demos.
- Unknown frontend routes now return a branded `404.html` page instead of a raw static-server response.
- Authentication logic is centralized in `backend/services/authService.js`, keeping route files small and avoiding token persistence. The public login/register pages disable Google sign-in automatically when OAuth credentials are not configured.
- Sequelize models now define validation, indexes, ownership relations and cascade cleanup for user-owned favourites/recent searches.
- Legacy academic authentication, attraction CRUD, partial migration and Sequelize CLI config files were removed; the public API now exposes only the routes used by the current app.

## Portfolio Roadmap

Planned improvements for the public portfolio version:

- Replace generic LLM prompting with a dedicated recommendation pipeline.
- Add a local recommendation model trained on curated tourism/attraction data.
- Add attraction scoring based on user preferences, distance, category and trip duration.
- Reintroduce attraction catalog CRUD only after a real data model, admin use case and validation rules exist.
- Improve frontend UI consistency and responsiveness.
- Add automated end-to-end smoke tests for auth, search, favourites and profile flows.
- Continue splitting large frontend/backend modules where it improves readability.
- Add screenshots and demo video/GIF.
- Add automated tests for authentication, itinerary generation and favourites.
- Add explicit production migrations when the schema becomes stable.
- Add seed data for reproducible demos.

## Security Notes

The cleaned repository removes:

- hardcoded Google Maps API keys;
- personal profile uploads;
- personal contact details;
- hardcoded database passwords;
- unused legacy authentication/attraction CRUD modules;
- partial legacy migration/config files that did not match the active models;
- private runtime configuration.

Before making further versions public, check for secrets with tools such as:

```bash
git grep -n "AIza\|OPENAI_API_KEY\|PASSWORD\|SECRET\|PRIVATE_KEY"
```

## Authors

See [AUTHORS.md](AUTHORS.md).

## License

This project is released under the MIT License. See [LICENSE](LICENSE).
