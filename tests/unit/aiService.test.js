import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildOpenAIInput,
  buildOpenAIResponsesRequest,
  extractResponsesText,
  normalizeGeneratedPayload,
} = require('../../backend/services/aiService.js');

describe('AI itinerary service', () => {
  it('builds a compact OpenAI request payload from search and preference context', () => {
    const payload = buildOpenAIInput({
      generalQuery: 'cultural route with viewpoints and local food',
      selectedCountries: ['Portugal'],
      selectedCities: ['Braga'],
      selectedAttractions: ['culture', 'viewpoints', 'food'],
      selectedDays: ['1'],
    }, {
      userPreferences: {
        transportMode: 'walking',
        travelPace: 'relaxed',
        favoriteInterests: ['Museums'],
      },
    });

    expect(payload.request).toMatchObject({
      selectedCountries: ['Portugal'],
      selectedCities: ['Braga'],
      selectedDays: 1,
      travelMode: 'WALK',
      language: 'en',
    });
    expect(payload.outputRequirements).toMatchObject({
      minStopsTotal: 4,
      maxStopsTotal: 6,
      includePlaceQueries: true,
    });
  });

  it('creates a Responses API request with strict structured output', () => {
    const request = buildOpenAIResponsesRequest({
      generalQuery: 'first-time visitor route',
      selectedCountries: ['Portugal'],
      selectedCities: ['Braga'],
      selectedAttractions: ['culture'],
      selectedDays: ['2'],
    });

    expect(request.instructions).toContain('itinerary generation engine');
    expect(request.text.format).toMatchObject({
      type: 'json_schema',
      name: 'travel_itinerary_generation',
      strict: true,
    });
    expect(request.text.format.schema.required).toEqual(['itinerary', 'monuments', 'recommendation']);
    expect(request.store).toBe(false);
  });

  it('extracts output text from a Responses API response', () => {
    const text = extractResponsesText({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: '{"itinerary":[],"monuments":[],"recommendation":{}}',
            },
          ],
        },
      ],
    });

    expect(text).toContain('itinerary');
  });

  it('normalizes rich itinerary and stop metadata while preserving display labels', () => {
    const result = normalizeGeneratedPayload({
      itinerary: [
        {
          day: 1,
          title: 'Historic Braga',
          city: 'Braga',
          summary: 'A focused cultural day.',
          activities: [
            {
              period: 'morning',
              name: 'Bom Jesus do Monte',
              placeQuery: 'Bom Jesus do Monte, Braga, Portugal',
              address: 'Braga, Portugal',
              city: 'Braga',
              country: 'Portugal',
              category: 'landmark',
              durationMinutes: 90,
              reason: 'Iconic sanctuary and viewpoint.',
              mapsSearchHint: 'Bom Jesus Braga',
            },
          ],
        },
      ],
      monuments: [
        {
          name: 'Bom Jesus do Monte',
          placeQuery: 'Bom Jesus do Monte, Braga, Portugal',
          address: 'Braga, Portugal',
          city: 'Braga',
          country: 'Portugal',
          category: 'landmark',
          tags: ['culture', 'viewpoint'],
          durationMinutes: 90,
          reason: 'Iconic sanctuary and viewpoint.',
          mapsSearchHint: 'Bom Jesus Braga',
        },
      ],
      recommendation: {
        title: 'Cultural Braga route',
        summary: 'Balanced one-day route.',
        bestFor: ['first-time visitors'],
        pace: 'moderate',
        estimatedStops: 1,
      },
    });

    expect(result.itinerary[0]).toMatchObject({
      title: 'Historic Braga',
      summary: 'A focused cultural day.',
    });
    expect(result.itinerary[0].activities[0]).toContain('Bom Jesus do Monte');
    expect(result.itinerary[0].activityDetails[0]).toMatchObject({
      period: 'morning',
      placeQuery: 'Bom Jesus do Monte, Braga, Portugal',
    });
    expect(result.monuments[0]).toMatchObject({
      placeQuery: 'Bom Jesus do Monte, Braga, Portugal',
      mapsSearchHint: 'Bom Jesus Braga',
      country: 'Portugal',
    });
    expect(result.recommendation.bestFor).toEqual(['first-time visitors']);
  });
});
