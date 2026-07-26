export class DeliveryInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "DeliveryInputError";
    this.status = status;
  }
}

export function normalizePoint(lat, lon, label = "Coordinates") {
  const normalizedLat = Number(lat);
  const normalizedLon = Number(lon);
  if (
    lat == null
    || lon == null
    || lat === ""
    || lon === ""
    || !Number.isFinite(normalizedLat)
    || !Number.isFinite(normalizedLon)
    || normalizedLat < -90
    || normalizedLat > 90
    || normalizedLon < -180
    || normalizedLon > 180
  ) {
    throw new DeliveryInputError(`${label} are invalid`);
  }
  return { lat: normalizedLat, lon: normalizedLon };
}

export function tryNormalizePoint(lat, lon) {
  try {
    return normalizePoint(lat, lon);
  } catch {
    return null;
  }
}

export function parseTripInput(body, { freeTier = false } = {}) {
  const {
    originLat,
    originLon,
    destinationLat,
    destinationLon,
    waypoints,
    deviationKm,
    departureTime,
  } = body || {};

  let origin;
  let destination;
  try {
    origin = normalizePoint(originLat, originLon, "Origin coordinates");
    destination = normalizePoint(
      destinationLat,
      destinationLon,
      "Destination coordinates",
    );
  } catch {
    throw new DeliveryInputError("origin and destination required");
  }

  if (waypoints != null && !Array.isArray(waypoints)) {
    throw new DeliveryInputError("Waypoints must be an array");
  }
  if ((waypoints?.length || 0) > 5) {
    throw new DeliveryInputError("A trip cannot contain more than 5 waypoints");
  }

  const normalizedWaypoints = (waypoints || []).map((waypoint) => ({
    ...normalizePoint(waypoint?.lat, waypoint?.lon, "Waypoint coordinates"),
    ...(waypoint?.address ? { address: waypoint.address } : {}),
  }));

  const normalizedDeviation = deviationKm == null || deviationKm === ""
    ? 2
    : Number(deviationKm);
  if (
    !Number.isFinite(normalizedDeviation)
    || normalizedDeviation < 0
    || normalizedDeviation > 10
  ) {
    throw new DeliveryInputError("deviationKm must be between 0 and 10");
  }

  return {
    origin,
    destination,
    waypoints: freeTier ? [] : normalizedWaypoints,
    // Free accounts keep the existing 2 km radius but cannot customize it.
    deviationKm: freeTier ? 2 : normalizedDeviation,
    departureTime: departureTime || null,
  };
}

export function parseDeliveryActionInput(body, requiredFields) {
  const input = body || {};
  if (requiredFields.some((field) => !input[field])) {
    throw new DeliveryInputError(`${requiredFields.join(" and ")} required`);
  }
  return Object.fromEntries(
    requiredFields.map((field) => [field, input[field]]),
  );
}
