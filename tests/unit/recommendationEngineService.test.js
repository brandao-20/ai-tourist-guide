import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { generateRecommendationPlan, normalizePreferences } = require('../../backend/services/recommendationEngineService.js');

describe('recommendation engine', () => {
  it('normalizes preference input', () => {
    expect(normalizePreferences({ travelPace: 'relaxed', favoriteInterests: ['Museums'] })).toMatchObject({
      travelPace: 'relaxed',
      favoriteInterests: ['Museums'],
    });
  });

  it('generates itinerary days and stops from a valid request', () => {
    const result = generateRecommendationPlan({
      generalQuery: 'Historic viewpoints and museums',
      selectedCountries: ['PT'],
      selectedCities: ['Lisbon'],
      selectedAttractions: ['Museums', 'Viewpoints'],
      selectedDays: ['2'],
    }, { travelPace: 'balanced' });

    expect(result.itinerary.length).toBe(2);
    expect(result.monuments.length).toBeGreaterThan(0);
    expect(result.recommendation.engine).toBe('local-scoring-v1');
  });
});
