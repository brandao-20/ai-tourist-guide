const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const SUPPORTED_AI_PROVIDERS = ['mock', 'ollama', 'openai'];
const DEFAULT_NODE_ENV = 'development';
const DEFAULT_FRONTEND_URL = 'http://localhost:8080';
const DEFAULT_SESSION_SECRET = 'development_session_secret_change_me';
const PLACEHOLDER_PREFIXES = ['your_', 'replace_', 'change_me'];

function readString(name, fallback = '') {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function parseBoolean(value, fallback = false) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCsv(value, fallback = []) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeUrl(value, fallback) {
  return readStringValue(value, fallback).replace(/\/+$/, '');
}

function readStringValue(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function hasConfiguredValue(value) {
  if (!value) {
    return false;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return !PLACEHOLDER_PREFIXES.some((prefix) => normalized.startsWith(prefix)) &&
    normalized !== DEFAULT_SESSION_SECRET;
}

function resolveSessionSecret(isProduction) {
  const configuredSecret = readString('SESSION_SECRET');

  if (hasConfiguredValue(configuredSecret)) {
    return configuredSecret;
  }

  if (isProduction) {
    throw new Error('SESSION_SECRET must be configured with a strong value in production.');
  }

  return DEFAULT_SESSION_SECRET;
}

function resolveAiProvider() {
  const provider = readString('TRAVEL_AI_PROVIDER', 'mock').toLowerCase();
  return SUPPORTED_AI_PROVIDERS.includes(provider) ? provider : 'mock';
}

function buildConfig() {
  const nodeEnv = readString('NODE_ENV', DEFAULT_NODE_ENV);
  const isProduction = nodeEnv === 'production';
  const frontendUrl = normalizeUrl(process.env.FRONTEND_URL, DEFAULT_FRONTEND_URL);
  const corsOrigins = unique(parseCsv(process.env.CORS_ORIGINS, [frontendUrl]));
  const googleMapsApiKey = readString('GOOGLE_MAPS_SERVER_API_KEY') || readString('GOOGLE_MAPS_API_KEY');
  const databaseUrl = readString('DATABASE_URL');
  const googleClientId = readString('GOOGLE_CLIENT_ID');
  const googleClientSecret = readString('GOOGLE_CLIENT_SECRET');

  return {
    env: nodeEnv,
    isProduction,
    server: {
      port: parsePositiveInteger(process.env.PORT, 5000),
      frontendUrl,
      jsonBodyLimit: readString('JSON_BODY_LIMIT', '10mb'),
    },
    health: {
      timeoutMs: parsePositiveInteger(process.env.HEALTHCHECK_TIMEOUT_MS, 3000),
    },
    cors: {
      origins: corsOrigins,
    },
    session: {
      secret: resolveSessionSecret(isProduction),
      cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: readString('SESSION_COOKIE_SAMESITE', 'lax'),
      },
    },
    database: {
      url: hasConfiguredValue(databaseUrl) ? databaseUrl : '',
      host: readString('DB_HOST', 'localhost'),
      port: parsePositiveInteger(process.env.DB_PORT, 5432),
      user: readString('DB_USER', 'postgres'),
      password: readString('DB_PASSWORD'),
      name: readString('DB_NAME', 'personalized_tourist_guide'),
      logging: parseBoolean(process.env.DB_LOGGING, false),
      syncAlter: parseBoolean(process.env.DB_SYNC_ALTER, false),
    },
    googleOAuth: {
      enabled: hasConfiguredValue(googleClientId) && hasConfiguredValue(googleClientSecret),
      strategyOptions: {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: readString('GOOGLE_CALLBACK_URL', 'http://localhost:5000/auth/google/callback'),
      },
    },
    googleMaps: {
      serverApiKey: hasConfiguredValue(googleMapsApiKey) ? googleMapsApiKey : '',
      geocodingTimeoutMs: parsePositiveInteger(process.env.GEOCODING_TIMEOUT_MS, 7000),
    },
    ai: {
      provider: resolveAiProvider(),
      timeoutMs: parsePositiveInteger(process.env.AI_PROVIDER_TIMEOUT_MS, 20000),
      ollamaBaseUrl: normalizeUrl(process.env.OLLAMA_BASE_URL, 'http://localhost:11434'),
      ollamaModel: readString('OLLAMA_MODEL', 'llama3.1:8b'),
      openaiApiKey: readString('OPENAI_API_KEY'),
      openaiModel: readString('OPENAI_MODEL', 'gpt-4o-mini'),
    },
  };
}

const appConfig = buildConfig();

module.exports = {
  appConfig,
  hasConfiguredValue,
  parseBoolean,
  parsePositiveInteger,
};
