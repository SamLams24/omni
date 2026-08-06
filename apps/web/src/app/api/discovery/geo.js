import { deriveVerificationStatus } from "@/lib/vendor-verification";

export const DEFAULT_NEARBY_RADIUS_METERS = 10000;
export const MAX_NEARBY_RADIUS_METERS = 50000;
export const DEFAULT_NEARBY_LIMIT = 50;
export const MAX_NEARBY_LIMIT = 100;

export class GeoValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "GeoValidationError";
  }
}

function readValue(source, key) {
  if (source instanceof URLSearchParams) {
    return source.get(key);
  }
  return source?.[key];
}

function parseRequiredCoordinate(source, key, min, max) {
  const rawValue = readValue(source, key);
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    throw new GeoValidationError(`Missing ${key} coordinate`);
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new GeoValidationError(
      `${key} must be a number between ${min} and ${max}`,
    );
  }
  return value;
}

function parsePositiveInteger(source, key, defaultValue, max) {
  const rawValue = readValue(source, key);
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return defaultValue;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new GeoValidationError(
      `${key} must be an integer between 1 and ${max}`,
    );
  }
  return value;
}

export function parseNearbyParams(
  source,
  {
    defaultRadius = DEFAULT_NEARBY_RADIUS_METERS,
    defaultLimit = DEFAULT_NEARBY_LIMIT,
  } = {},
) {
  return {
    lat: parseRequiredCoordinate(source, "lat", -90, 90),
    lon: parseRequiredCoordinate(source, "lon", -180, 180),
    radius: parsePositiveInteger(
      source,
      "radius",
      defaultRadius,
      MAX_NEARBY_RADIUS_METERS,
    ),
    limit: parsePositiveInteger(
      source,
      "limit",
      defaultLimit,
      MAX_NEARBY_LIMIT,
    ),
  };
}

export function parseSearchTerm(source) {
  const search = String(readValue(source, "search") || "").trim();
  if (!search) {
    throw new GeoValidationError("A search query is required");
  }
  if (search.length > 100) {
    throw new GeoValidationError("Search query must not exceed 100 characters");
  }
  return search;
}

export function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function normalizeGeoRow(row) {
  const normalized = {
    ...row,
    lat: Number(row.lat),
    lon: Number(row.lon),
    distance: Number(row.distance),
    rating: row.rating == null ? null : Number(row.rating),
    product_count: Number(row.product_count || 0),
    review_count: Number(row.review_count || 0),
    avg_price: Number(row.avg_price || 0),
  };

  if ("kyc_status" in row) {
    normalized.source = "omni";
    normalized.verification_status = deriveVerificationStatus({
      source: "omni",
      claimed: Boolean(row.claimed),
      kycStatus: row.kyc_status,
      subscriptionActive: Boolean(row.subscription_active),
    });
    delete normalized.kyc_status;
    delete normalized.claimed;
    delete normalized.subscription_active;
  }

  return normalized;
}
