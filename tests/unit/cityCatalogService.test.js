import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { listCountries, listCitiesByCountry, normalizeCountryCode } = require('../../backend/services/cityCatalogService.js');

describe('city catalog', () => {
  it('normalizes country codes', () => {
    expect(normalizeCountryCode(' pt ')).toBe('PT');
  });

  it('lists countries and cities', () => {
    expect(listCountries().length).toBeGreaterThan(0);
    expect(listCitiesByCountry('PT').length).toBeGreaterThan(0);
  });
});
