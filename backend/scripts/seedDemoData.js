#!/usr/bin/env node

const bcrypt = require('bcrypt');
const db = require('../models');
const { generateRecommendationPlan } = require('../services/recommendationEngineService');
const { buildMonumentsWithCoordinates } = require('../services/itinerarySearchService');
const { normalizeTravelPreferences } = require('../services/userPreferenceService');

const DEMO_EMAIL = process.env.DEMO_USER_EMAIL || 'demo@example.com';
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'Password123!';
const DEMO_NAME = process.env.DEMO_USER_NAME || 'Demo Traveller';

const demoPreferences = normalizeTravelPreferences({
  travelPace: 'balanced',
  budget: 'flexible',
  transportMode: 'driving',
  walkingTolerance: 'medium',
  favoriteInterests: ['Historic Neighborhoods', 'Viewpoints', 'Local Experiences', 'Museums'],
  notes: 'Prefers scenic routes with local food and compact walking sections.',
});

const demoSearchPayload = {
  generalQuery: 'historic viewpoints, local food and walkable areas',
  selectedCountries: ['PT'],
  selectedCities: ['Braga', 'Portimão'],
  selectedAttractions: ['Monuments', 'Viewpoints', 'Museums', 'Local Experiences'],
  selectedDays: ['3'],
};

async function upsertDemoUser() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [user] = await db.User.findOrCreate({
    where: { email: DEMO_EMAIL },
    defaults: {
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      password: passwordHash,
      travelPreferences: demoPreferences,
    },
  });

  user.name = DEMO_NAME;
  user.password = passwordHash;
  user.travelPreferences = demoPreferences;
  await user.save();

  return user;
}

function buildDemoMapData(monuments) {
  const stops = monuments.slice(0, 5);
  const legs = stops.slice(0, -1).map((stop, index) => ({
    start_address: stop.address || stop.name,
    end_address: stops[index + 1].address || stops[index + 1].name,
    distance: { text: `${Math.max(2, index + 2)} km` },
    duration: { text: `${15 + index * 7} mins` },
    steps: [{ instructions: `Travel from ${stop.name} to ${stops[index + 1].name}.` }],
  }));

  return {
    provider: 'seed-fixture-google-maps-ready',
    routes: [{ summary: 'Demo portfolio route', legs }],
  };
}

async function seedDemoData() {
  await db.sequelize.authenticate();
  await db.sequelize.sync({ alter: process.env.DB_SYNC_ALTER === 'true' });

  const user = await upsertDemoUser();
  const plan = generateRecommendationPlan(demoSearchPayload, demoPreferences);
  const monuments = await buildMonumentsWithCoordinates(plan.monuments);
  const mapData = buildDemoMapData(monuments);

  const favoritePayload = {
    user_id: user.id,
    name: 'Braga → Portimão demo route',
    itinerary: {
      days: plan.itinerary,
      monuments,
      recommendation: plan.recommendation,
    },
    map_data: mapData,
  };

  const existingFavorite = await db.FavoriteItinerary.findOne({
    where: { user_id: user.id, name: favoritePayload.name },
  });

  if (existingFavorite) {
    await existingFavorite.update(favoritePayload);
  } else {
    await db.FavoriteItinerary.create(favoritePayload);
  }

  await db.RecentSearches.create({
    user_id: user.id,
    query_params: demoSearchPayload,
    itinerary: plan.itinerary,
    monuments,
    directions: mapData,
  });

  console.log(`Demo data ready: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  await db.sequelize.close();
}

seedDemoData().catch(async (error) => {
  console.error('Failed to seed demo data:', error.message);
  try {
    await db.sequelize.close();
  } catch (_) {
    // noop
  }
  process.exit(1);
});
