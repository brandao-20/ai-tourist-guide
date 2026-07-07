import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildRouteSignature } = require('../../backend/services/favoriteItineraryService.js');

describe('saved route service', () => {
  it('builds a stable signature from stops', () => {
    const signature = buildRouteSignature({
      itinerary: {
        monuments: [
          { name: 'A', address: 'A Street', coordinates: { lat: 41.123456, lng: -8.123456 } },
          { name: 'B', address: 'B Street', coordinates: { lat: 41.654321, lng: -8.654321 } },
        ],
      },
    });

    expect(signature).toContain('41.12346,-8.12346');
    expect(signature).toContain('41.65432,-8.65432');
  });
});
