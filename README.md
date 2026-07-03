# Personalized Tourist Guide AI

Portfolio-ready version of an academic web application for personalized tourist recommendations, interactive map exploration and AI-assisted itinerary planning.

The project combines a JavaScript/Svelte frontend, a Node.js/Express backend, PostgreSQL/PostGIS storage, Google Maps integration and a configurable AI layer that can run in **mock**, **local model/Ollama** or **OpenAI** mode.

> This repository is a cleaned and restructured version of the original academic project, prepared for public portfolio usage. Sensitive data, hardcoded API keys, personal uploads and private contact details were removed.

## Features

- User registration and login.
- Optional Google OAuth authentication.
- Interactive Google Maps-based exploration.
- Country/city filtering using a local cities dataset.
- Personalized travel search with itinerary generation.
- Configurable AI provider:
  - `mock` for free local testing without API costs;
  - `ollama` for local LLM inference;
  - `openai` for API-based generation if explicitly configured.
- Google Geocoding support for itinerary places.
- Favourite itinerary saving.
- Recent search persistence.
- User profile editing and profile image upload.
- Docker Compose setup with PostgreSQL/PostGIS, backend and frontend services.

## Tech Stack

### Frontend

- JavaScript
- Svelte
- HTML/CSS
- Rollup
- Axios
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
│   ├── controllers/
│   ├── data/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── scripts/
│   ├── services/
│   └── server.js
├── frontend/                # Svelte/static frontend and public pages
│   ├── public/
│   └── src/
├── docs/                    # Project notes and roadmap
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

Update values as needed. The default AI provider is `mock`, so the application can be tested without paid AI APIs.

### 3. Configure frontend runtime settings

Edit `frontend/public/config.js`:

```js
window.APP_CONFIG = {
  API_BASE_URL: 'http://localhost:5000',
  GOOGLE_MAPS_BROWSER_API_KEY: 'your_restricted_browser_key',
};
```

For public repositories, never commit real API keys. Browser keys should be restricted in Google Cloud by HTTP referrer and API scope.

### 4. Run with Docker Compose

```bash
docker compose up --build
```

Default local services:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:5000`
- PostgreSQL/PostGIS: host port `5434`

### 5. Synchronize database tables

In another terminal:

```bash
npm run db:sync
```

For development schema updates, set this in `.env` before running the sync command:

```env
DB_SYNC_ALTER=true
```

## AI Provider Configuration

The backend uses `TRAVEL_AI_PROVIDER` to choose the itinerary generation provider.

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

## Portfolio Roadmap

Planned improvements for the public portfolio version:

- Replace generic LLM prompting with a dedicated recommendation pipeline.
- Add a local recommendation model trained on curated tourism/attraction data.
- Add attraction scoring based on user preferences, distance, category and trip duration.
- Improve frontend UI consistency and responsiveness.
- Add screenshots and demo video/GIF.
- Add automated tests for authentication, itinerary generation and favourites.
- Add seed data for reproducible demos.

## Security Notes

The cleaned repository removes:

- hardcoded Google Maps API keys;
- personal profile uploads;
- personal contact details;
- hardcoded database passwords;
- private runtime configuration.

Before making further versions public, check for secrets with tools such as:

```bash
git grep -n "AIza\|OPENAI_API_KEY\|PASSWORD\|SECRET\|PRIVATE_KEY"
```

## Authors

See [AUTHORS.md](AUTHORS.md).

## License

This project is released under the MIT License. See [LICENSE](LICENSE).
