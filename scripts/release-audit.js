#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REQUIRED_FILES = [
  'README.md',
  'AUTHORS.md',
  'LICENSE',
  '.env.example',
  '.gitignore',
  'docker-compose.yml',
  'backend/package.json',
  'frontend/package.json',
  'frontend/public/index.html',
  'frontend/public/contact.html',
  'frontend/public/login.html',
  'frontend/public/register.html',
  'frontend/public/home_logged.html',
  'frontend/public/mainapp.html',
  'frontend/public/favorites.html',
  'frontend/public/profile.html',
  'frontend/public/route_details.html',
  'frontend/src/favorites.js',
  'frontend/src/routeExport.js',
  '.github/workflows/ci.yml',
];

const REQUIRED_IGNORES = ['.env', 'node_modules/', 'frontend/public/build/', 'backend/uploads/*'];
const PUBLIC_HTML_FILES = [
  'frontend/public/index.html',
  'frontend/public/contact.html',
  'frontend/public/login.html',
  'frontend/public/register.html',
];

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const errors = [];

REQUIRED_FILES.forEach((file) => {
  if (!exists(file)) {
    errors.push(`Missing required release file: ${file}`);
  }
});

const gitignore = read('.gitignore');
REQUIRED_IGNORES.forEach((pattern) => {
  if (!gitignore.includes(pattern)) {
    errors.push(`.gitignore is missing required pattern: ${pattern}`);
  }
});

const envExample = read('.env.example');
[
  'GOOGLE_MAPS_BROWSER_API_KEY',
  'GOOGLE_MAPS_SERVER_API_KEY',
  'GOOGLE_ROUTES_API_KEY',
  'GOOGLE_PLACES_API_KEY',
  'SESSION_SECRET',
  'TRAVEL_AI_PROVIDER',
  'DB_PASSWORD',
].forEach((name) => {
  if (!envExample.includes(name)) {
    errors.push(`.env.example is missing ${name}`);
  }
});

const homeHtml = read('frontend/public/index.html');
['Home', 'Contact', 'Sign in', 'Create account'].forEach((label) => {
  if (!homeHtml.includes(label)) {
    errors.push(`Public homepage navigation is missing: ${label}`);
  }
});

['Status', 'Start local demo', 'Smoke tests', 'Docker', 'Academic portfolio project', 'portfolio-ready demo', 'portfolio baseline', 'demo baseline'].forEach((forbiddenText) => {
  if (homeHtml.includes(forbiddenText)) {
    errors.push(`Public homepage still exposes technical/reviewer wording: ${forbiddenText}`);
  }
});

const authenticatedHtml = read('frontend/public/home_logged.html');
['Dashboard', 'Plan trip', 'Saved routes', 'Profile', 'Sign out'].forEach((label) => {
  if (!authenticatedHtml.includes(label)) {
    errors.push(`Authenticated navigation is missing: ${label}`);
  }
});

PUBLIC_HTML_FILES.forEach((file) => {
  const content = read(file);
  ['seeded demo', 'Fill demo credentials', 'npm run seed:demo', 'local demo', 'smoke tested', 'health check', 'reviewer'].forEach((forbiddenText) => {
    if (content.toLowerCase().includes(forbiddenText.toLowerCase())) {
      errors.push(`${file} still exposes public technical/demo wording: ${forbiddenText}`);
    }
  });
});

if (errors.length > 0) {
  console.error('Release audit failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Release audit passed: product navigation, public-safety checks and required files are present.');
