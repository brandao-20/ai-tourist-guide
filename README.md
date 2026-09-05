# AI Tourist Guide

A full-stack AI-assisted travel planning application for creating personalised itineraries based on destination, available time, interests and travel preferences.

The platform combines AI-generated travel plans with real-world place and routing data, persistent user accounts and interactive maps, while remaining usable through local fallbacks when optional external providers are unavailable.

## Features

### AI-Assisted Itinerary Generation

Generate structured travel itineraries from:

- selected countries
- one or multiple cities
- trip duration
- preferred interests
- travel pace
- budget preferences
- transport preferences
- free-text requests

For multi-city trips, the itinerary generator treats the selected cities as an ordered route and builds a coherent progression from origin to destination.

### Structured AI Output

When OpenAI is configured, itinerary generation uses structured outputs to produce predictable travel data including:

- day-by-day itinerary
- activity periods
- stop names
- cities and countries
- place search queries
- activity categories
- estimated visit duration
- recommendation reasons
- route-friendly search hints

The resulting itinerary can then be enriched with external mapping and place data.

### Google Maps Integration

Optional Google integrations provide:

- interactive maps
- place search
- geocoding
- real-world place enrichment
- addresses
- ratings and coordinates
- route distance and duration metadata

Supported services include:

- Google Maps JavaScript API
- Google Places API
- Google Routes API
- Google Geocoding API

The application remains functional when Google integrations are not configured.

### Local Recommendation Fallback

AI services are optional.

When a valid OpenAI configuration is unavailable, the backend automatically falls back to a local recommendation engine so itinerary generation remains testable without external API usage.

### User Accounts

The application supports:

- account creation
- local authentication
- persistent sessions
- optional Google OAuth
- user profile management
- profile image upload
- travel preference storage

### Travel Preferences

Users can maintain preferences such as:

- favourite interests
- travel pace
- budget
- walking tolerance
- transport mode
- additional travel notes

These preferences can be reused when generating future routes.

### Personal Dashboard

Authenticated users have access to a dashboard containing:

- recent routes
- recent searches
- active travel preferences
- quick access to trip planning

### Saved Routes

Generated itineraries can be saved and revisited later.

The saved-routes interface supports:

- route browsing
- search
- sorting
- detailed itinerary views
- route removal
- itinerary timeline
- map visualisation
- export actions

### Input Validation and Upload Safety

The backend includes:

- runtime request validation with Zod
- controlled profile-image uploads
- file type validation
- upload size limits
- environment-based configuration
- restricted production database synchronisation

## Tech Stack

### Frontend

- HTML5
- CSS3
- JavaScript
- Rollup
- Google Maps JavaScript API

### Backend

- Node.js
- Express
- Passport
- Sequelize
- Zod
- Multer

### Database

- PostgreSQL
- PostGIS

### AI

- OpenAI Responses API
- Structured Outputs
- local recommendation fallback

### External Services

- Google Maps
- Google Places
- Google Routes
- Google Geocoding
- Google OAuth

### Testing & Quality

- Vitest
- Playwright
- custom smoke tests
- security scanning
- release auditing

### Infrastructure

- Docker
- Docker Compose

## Architecture

```text
┌─────────────────────────┐
│        Frontend         │
│  HTML · CSS · JavaScript│
│        Rollup           │
└────────────┬────────────┘
             │
             │ HTTP
             ▼
┌─────────────────────────┐
│      Express API        │
│                         │
│ Auth · Users · Routes   │
│ Preferences · Uploads   │
└───────┬─────────┬───────┘
        │         │
        │         │
        ▼         ▼
┌─────────────┐  ┌────────────────────┐
│ PostgreSQL  │  │   AI Provider      │
│   PostGIS   │  │                    │
│             │  │ OpenAI / Local     │
└─────────────┘  │     Fallback       │
                 └─────────┬──────────┘
                           │
                           ▼
                 ┌────────────────────┐
                 │ Google Services    │
                 │                    │
                 │ Places · Routes    │
                 │ Maps · Geocoding   │
                 └────────────────────┘
```

## Itinerary Generation Flow

```text
User Request
    │
    ▼
Travel Preferences
    │
    ▼
AI / Local Recommendation Engine
    │
    ▼
Structured Itinerary
    │
    ▼
Google Places Enrichment
    │
    ▼
Google Routes Metadata
    │
    ▼
Final Itinerary
    │
    ├── Timeline
    ├── Interactive Map
    └── Saved Route
```

External enrichment is optional. The core itinerary remains available when third-party providers are not configured.

## Project Structure

```text
ai-tourist-guide/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── server.js
├── frontend/
│   ├── public/
│   └── src/
├── scripts/
├── tests/
├── .env.example
├── docker-compose.yml
├── package.json
├── AUTHORS.md
├── LICENSE
└── README.md
```

## Getting Started

### Requirements

- Node.js 18+
- npm
- Docker and Docker Compose

Docker is recommended because it provides the complete application stack, including PostgreSQL/PostGIS.

## Installation

Clone the repository:

```bash
git clone https://github.com/brandao-20/ai-tourist-guide.git
cd ai-tourist-guide
```

Install the workspace dependencies:

```bash
npm install
```

## Environment Configuration

Create a local environment file from the provided example.

macOS / Linux:

```bash
cp .env.example .env
```

Windows:

```powershell
Copy-Item .env.example .env
```

At minimum, configure a strong local session secret:

```env
SESSION_SECRET=replace_with_a_long_random_value
```

Database configuration:

```env
DB_HOST=db
DB_PORT=5432
DB_NAME=tourist_guide
DB_USER=postgres
DB_PASSWORD=postgres
```

External providers are optional.

## Running with Docker

Start the complete application stack:

```bash
docker compose up --build
```

Default local services:

```text
Frontend          http://localhost:8080
Backend API       http://localhost:5000
PostgreSQL        localhost:5434
```

Stop the stack:

```bash
docker compose down
```

Reset the local containers and database volume:

```bash
docker compose down -v
docker compose up --build
```

Use the reset command only when you intentionally want to remove the local database state.

## Running without Docker

Build the frontend:

```bash
npm run build:frontend
```

Start the backend:

```bash
npm run start:backend
```

Start the frontend in another terminal:

```bash
npm run start:frontend
```

## AI Configuration

### Local Fallback

The application can run without a live AI API.

When no valid OpenAI configuration is available, the backend uses its local recommendation engine.

### OpenAI

Enable live AI itinerary generation with:

```env
TRAVEL_AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5.4-mini
AI_PROVIDER_TIMEOUT_MS=60000
```

The OpenAI integration uses the Responses API with Structured Outputs to validate the generated itinerary against the application's expected schema.

The generated result contains structured fields designed for subsequent Google Places and Google Routes enrichment.

Never commit API credentials to the repository.

## Google Maps Configuration

### Browser Map

```env
GOOGLE_MAPS_BROWSER_API_KEY=your_restricted_browser_key
```

Used for the interactive map displayed in the frontend.

### Server-Side Geocoding

```env
GOOGLE_MAPS_SERVER_API_KEY=your_restricted_server_key
```

Used by backend geocoding helpers.

### Google Places

```env
GOOGLE_PLACES_API_KEY=your_restricted_places_key
GOOGLE_PLACES_TIMEOUT_MS=8000
GOOGLE_PLACES_LANGUAGE_CODE=en
GOOGLE_PLACES_ENRICH_ITINERARIES=true
GOOGLE_PLACES_ENRICHMENT_LIMIT=12
```

Used to enrich itinerary stops with real-world place information.

### Google Routes

```env
GOOGLE_ROUTES_API_KEY=your_restricted_routes_key
GOOGLE_ROUTES_TIMEOUT_MS=8000
```

Used to obtain route distance, duration and travel metadata.

Browser API keys should be restricted by HTTP referrer. Server-side keys should be restricted by API and environment.

## Google OAuth

Google authentication can be enabled through environment configuration.

When valid Google OAuth credentials are unavailable, local account authentication remains available.

## Database Synchronisation

Synchronise the database schema manually with:

```bash
npm run db:sync
```

The application also includes compatibility checks for existing local databases.

Controlled schema alteration can be enabled locally with:

```env
DB_SYNC_ALTER=true
```

This option is blocked in production.

## Testing

### Syntax Checks

```bash
npm run check
```

### Unit Tests

```bash
npm run test:unit
```

### End-to-End Tests

Install the Playwright browsers:

```bash
npx playwright install
```

Run the browser-flow tests:

```bash
npm run test:e2e
```

### Smoke Test

Against a running application:

```bash
npm run smoke:test
```

## Security and Release Checks

Run the security scan:

```bash
npm run security:scan
```

Run the release audit:

```bash
npm run release:audit
```

Run the complete release verification:

```bash
npm run check:release
```

The full release check combines:

```text
Syntax validation
Unit tests
Security scan
Release audit
```

## Public Repository Safety

Before publishing or deploying the application:

- never commit `.env`
- keep uploaded user files outside version control
- use a strong `SESSION_SECRET`
- restrict external API keys
- keep database credentials environment-based
- run the release verification scripts
- verify authentication and upload flows
- verify external-provider fallbacks

## Design Goals

### Graceful Degradation

Optional AI and Google services should improve the experience without making the application unusable when they are unavailable.

### Structured AI Integration

AI-generated itineraries follow a defined schema instead of relying on unrestricted free-form responses.

### Real-World Enrichment

Generated travel ideas can be connected to real places and routes through mapping services.

### Persistent Personalisation

User preferences and saved routes allow itinerary generation to become more relevant over repeated use.

### Full-Stack Reliability

The project includes validation, testing, security checks, environment configuration and containerised local infrastructure rather than focusing exclusively on the AI layer.

## Authorship & Attribution

The project was originally developed as an academic project in the Computer Engineering degree at Instituto Politécnico de Viana do Castelo.

The original academic contributors were:

- Gabriel da Silva Brandão
- Luís Filipe Esteves Dias

The public repository contains a cleaned and portfolio-oriented version of the original project.

See [AUTHORS.md](AUTHORS.md) for additional attribution details.

## License

This project is released under the MIT License.

See [LICENSE](LICENSE) for details.
