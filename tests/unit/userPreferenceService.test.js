import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeTravelPreferences } = require('../../backend/services/userPreferenceService.js');

describe('user preferences', () => {
  it('returns safe defaults for invalid input', () => {
    expect(normalizeTravelPreferences(null)).toMatchObject({
      travelPace: 'balanced',
      budget: 'flexible',
      transportMode: 'driving',
      walkingTolerance: 'medium',
    });
  });

  it('deduplicates interests and caps notes', () => {
    const preferences = normalizeTravelPreferences({
      travelPace: 'fast',
      favoriteInterests: ['Food', 'food', 'Museums'],
      notes: 'x'.repeat(300),
    });

    expect(preferences.favoriteInterests).toEqual(['Food', 'Museums']);
    expect(preferences.notes).toHaveLength(240);
  });
});
