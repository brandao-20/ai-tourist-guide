import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  itinerarySearchSchema,
  parseSchema,
  profileUpdateSchema,
  registerSchema,
  savedRouteCreateSchema,
} = require('../../backend/schemas/validationSchemas.js');

describe('validation schemas', () => {
  it('normalizes registration payloads', () => {
    const result = parseSchema(registerSchema, {
      name: '  Gabriel   Brandão ',
      email: ' GABRIEL@example.com ',
      password: 'Password123!',
    });

    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({
      name: 'Gabriel Brandão',
      email: 'gabriel@example.com',
    });
  });

  it('rejects weak registration passwords', () => {
    const result = parseSchema(registerSchema, {
      name: 'Traveller',
      email: 'traveller@example.com',
      password: 'short',
    });

    expect(result.error).toContain('at least 8 characters');
  });

  it('normalizes profile preferences', () => {
    const result = parseSchema(profileUpdateSchema, {
      name: 'Traveller',
      travelPreferences: {
        travelPace: 'relaxed',
        budget: 'flexible',
        transportMode: 'walking',
        walkingTolerance: 'high',
        favoriteInterests: ['Museums', 'Museums', 'Viewpoints'],
        notes: '  Short walks preferred. ',
      },
    });

    expect(result.value.travelPreferences.favoriteInterests).toEqual(['Museums', 'Viewpoints']);
    expect(result.value.travelPreferences.notes).toBe('Short walks preferred.');
  });

  it('validates itinerary search payloads', () => {
    const result = parseSchema(itinerarySearchSchema, {
      generalQuery: 'Cultural weekend with viewpoints',
      selectedCountries: ['PT'],
      selectedCities: ['Lisbon'],
      selectedAttractions: ['Museums'],
      selectedDays: ['2'],
    });

    expect(result.error).toBeUndefined();
    expect(result.value.selectedDays).toEqual(['2']);
  });

  it('accepts saved routes with fallback map data', () => {
    const result = parseSchema(savedRouteCreateSchema, {
      name: 'Lisbon route',
      itinerary: { monuments: [{ name: 'Stop A' }, { name: 'Stop B' }] },
      map_data: { fallback: true, routes: [] },
    });

    expect(result.error).toBeUndefined();
  });
});
