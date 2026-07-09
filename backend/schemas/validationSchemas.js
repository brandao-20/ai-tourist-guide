const { z } = require('zod');
const { DEFAULT_TRAVEL_PREFERENCES, normalizeTravelPreferences } = require('../services/userPreferenceService');

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_SEARCH_TEXT_LENGTH = 500;
const MAX_SEARCH_ITEMS = 30;
const MAX_SEARCH_ITEM_LENGTH = 120;
const MIN_TRIP_DAYS = 1;
const MAX_TRIP_DAYS = 14;
const MAX_ROUTE_NAME_LENGTH = 120;
const MAX_STORED_JSON_BYTES = 1_500_000;

function normalizeText(value, maxLength = MAX_SEARCH_ITEM_LENGTH) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
    : '';
}

function getJsonPayloadSize(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch (error) {
    return Number.POSITIVE_INFINITY;
  }
}

const nameSchema = z.preprocess(
  (value) => normalizeText(value, MAX_NAME_LENGTH),
  z.string().min(1, 'Name is required.').max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or less.`)
);

const emailSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''),
  z.string().min(1, 'Email is required.').email('Please provide a valid email address.').max(MAX_EMAIL_LENGTH)
);

const passwordSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value : ''),
  z.string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`)
    .max(MAX_PASSWORD_LENGTH, `Password must be ${MAX_PASSWORD_LENGTH} characters or less.`)
);

const optionalPasswordSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value : ''),
  z.string()
    .max(MAX_PASSWORD_LENGTH, `Password must be ${MAX_PASSWORD_LENGTH} characters or less.`)
    .refine((value) => value.length === 0 || value.length >= MIN_PASSWORD_LENGTH, {
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    })
    .transform((value) => value || null)
);

const travelPreferencesSchema = z.preprocess(
  (value) => normalizeTravelPreferences(value),
  z.object({
    travelPace: z.enum(['relaxed', 'balanced', 'fast']).default(DEFAULT_TRAVEL_PREFERENCES.travelPace),
    budget: z.enum(['low', 'medium', 'high', 'flexible']).default(DEFAULT_TRAVEL_PREFERENCES.budget),
    transportMode: z.enum(['walking', 'transit', 'driving', 'mixed']).default(DEFAULT_TRAVEL_PREFERENCES.transportMode),
    walkingTolerance: z.enum(['low', 'medium', 'high']).default(DEFAULT_TRAVEL_PREFERENCES.walkingTolerance),
    favoriteInterests: z.array(z.string()).max(10).default([]),
    notes: z.string().max(240).default(''),
  })
);

const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.preprocess(
    (value) => (typeof value === 'string' ? value : ''),
    z.string().min(1, 'Password is required.')
  ),
});

const profileUpdateSchema = z.object({
  name: nameSchema,
  password: optionalPasswordSchema.optional().default(null),
  travelPreferences: z.preprocess(
    (value) => (value === undefined ? undefined : normalizeTravelPreferences(value)),
    travelPreferencesSchema.optional()
  ),
});

const searchTextSchema = z.preprocess(
  (value) => normalizeText(value, MAX_SEARCH_TEXT_LENGTH),
  z.string().min(1, 'Search description is required.').max(MAX_SEARCH_TEXT_LENGTH)
);

const searchListSchema = (fieldLabel) => z.preprocess((value) => {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = [];

  source.slice(0, MAX_SEARCH_ITEMS).forEach((item) => {
    const text = normalizeText(item, MAX_SEARCH_ITEM_LENGTH);
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      normalized.push(text);
    }
  });

  return normalized;
}, z.array(z.string()).min(1, `${fieldLabel} must include at least one valid value.`).max(MAX_SEARCH_ITEMS));

const searchDaysSchema = z.preprocess((value) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const days = Number.parseInt(rawValue, 10);
  return Number.isInteger(days) ? days : null;
}, z.number({ message: `Duration must be between ${MIN_TRIP_DAYS} and ${MAX_TRIP_DAYS} days.` })
  .int()
  .min(MIN_TRIP_DAYS, `Duration must be between ${MIN_TRIP_DAYS} and ${MAX_TRIP_DAYS} days.`)
  .max(MAX_TRIP_DAYS, `Duration must be between ${MIN_TRIP_DAYS} and ${MAX_TRIP_DAYS} days.`)
  .transform((value) => [String(value)]));

const itinerarySearchSchema = z.object({
  generalQuery: searchTextSchema,
  selectedCountries: searchListSchema('Country'),
  selectedCities: searchListSchema('City'),
  selectedAttractions: searchListSchema('Interests'),
  selectedDays: searchDaysSchema,
});

const storedJsonSchema = ({ allowNull = false, requirePlainObject = false, fieldName = 'Payload' } = {}) => z.any()
  .superRefine((value, context) => {
    if (value === undefined || value === null) {
      if (allowNull) {
        return;
      }
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} is required.` });
      return;
    }

    const isObject = value !== null && typeof value === 'object';
    const isPlainObject = isObject && !Array.isArray(value);

    if (requirePlainObject ? !isPlainObject : !isObject) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} must be a valid JSON object or array.` });
      return;
    }

    if (getJsonPayloadSize(value) > MAX_STORED_JSON_BYTES) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} is too large.` });
    }
  })
  .transform((value) => (value === undefined ? null : value));

const routeNameSchema = z.preprocess(
  (value) => normalizeText(value, MAX_ROUTE_NAME_LENGTH),
  z.string().min(1, 'Saved route name is required.').max(MAX_ROUTE_NAME_LENGTH)
);

const savedRouteCreateSchema = z.object({
  name: z.preprocess(
    (value) => normalizeText(value, MAX_ROUTE_NAME_LENGTH) || 'Untitled itinerary',
    z.string().max(MAX_ROUTE_NAME_LENGTH)
  ),
  itinerary: storedJsonSchema({ fieldName: 'itinerary', requirePlainObject: true }),
  map_data: storedJsonSchema({ fieldName: 'map_data', requirePlainObject: true }),
});

const savedRouteNameSchema = z.object({
  name: routeNameSchema,
});

const recentSearchSchema = z.object({
  query_params: storedJsonSchema({ fieldName: 'query_params', requirePlainObject: true }),
  itinerary: storedJsonSchema({ fieldName: 'itinerary', allowNull: true }),
  monuments: storedJsonSchema({ fieldName: 'monuments', allowNull: true }),
  directions: storedJsonSchema({ fieldName: 'directions', allowNull: true }),
  routeMetadata: storedJsonSchema({ fieldName: 'routeMetadata', allowNull: true }),
});


function firstZodMessage(error) {
  return error?.issues?.[0]?.message || 'Invalid request payload.';
}

function parseSchema(schema, payload) {
  const result = schema.safeParse(payload === undefined ? {} : payload);
  if (!result.success) {
    return { error: firstZodMessage(result.error) };
  }

  return { value: result.data };
}

module.exports = {
  itinerarySearchSchema,
  loginSchema,
  parseSchema,
  profileUpdateSchema,
  recentSearchSchema,
  registerSchema,
  savedRouteCreateSchema,
  savedRouteNameSchema,
  travelPreferencesSchema,
  validateStoredJsonSchema: storedJsonSchema,
};
