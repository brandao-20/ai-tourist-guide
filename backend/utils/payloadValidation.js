const {
  itinerarySearchSchema,
  parseSchema,
  recentSearchSchema,
  savedRouteCreateSchema,
  savedRouteNameSchema,
  validateStoredJsonSchema,
} = require('../schemas/validationSchemas');

function parsePositiveIntegerParam(value) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function validateStoredJsonPayload(value, fieldName, options = {}) {
  return parseSchema(
    validateStoredJsonSchema({
      allowNull: Boolean(options.allowNull),
      requirePlainObject: Boolean(options.requirePlainObject),
      fieldName,
    }),
    value
  );
}

function normalizeSearchPayload(body = {}) {
  return parseSchema(itinerarySearchSchema, body);
}

function normalizeFavoriteNamePayload(body = {}) {
  return parseSchema(savedRouteNameSchema, body);
}

function normalizeFavoritePayload(body = {}) {
  return parseSchema(savedRouteCreateSchema, body);
}

function normalizeRecentSearchPayload(body = {}) {
  return parseSchema(recentSearchSchema, body);
}

module.exports = {
  parsePositiveIntegerParam,
  normalizeFavoritePayload,
  normalizeFavoriteNamePayload,
  normalizeRecentSearchPayload,
  normalizeSearchPayload,
  validateStoredJsonPayload,
};
