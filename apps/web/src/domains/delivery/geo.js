import {
  DeliveryInputError,
  normalizePoint,
  tryNormalizePoint,
} from "@/domains/delivery/input";

const EARTH_RADIUS_METERS = 6371000;
const toRadians = (value) => value * Math.PI / 180;

export function haversineDistanceMeters(from, to) {
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLon = toRadians(to.lon - from.lon);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(from.lat))
    * Math.cos(toRadians(to.lat))
    * Math.sin(deltaLon / 2) ** 2;
  return EARTH_RADIUS_METERS
    * 2
    * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toLocalMeters(point, origin) {
  const meanLat = toRadians((point.lat + origin.lat) / 2);
  return {
    x: toRadians(point.lon - origin.lon)
      * Math.cos(meanLat)
      * EARTH_RADIUS_METERS,
    y: toRadians(point.lat - origin.lat) * EARTH_RADIUS_METERS,
  };
}

export function pointToSegmentDistanceMeters(point, start, end) {
  const localPoint = toLocalMeters(point, start);
  const localEnd = toLocalMeters(end, start);
  const segmentLengthSquared = localEnd.x ** 2 + localEnd.y ** 2;
  if (segmentLengthSquared === 0) {
    return haversineDistanceMeters(point, start);
  }

  const projection = (
    localPoint.x * localEnd.x + localPoint.y * localEnd.y
  ) / segmentLengthSquared;
  const ratio = Math.max(0, Math.min(1, projection));
  return Math.hypot(
    localPoint.x - ratio * localEnd.x,
    localPoint.y - ratio * localEnd.y,
  );
}

export function distanceToRouteMeters(point, routePoints) {
  if (!Array.isArray(routePoints) || routePoints.length < 2) {
    throw new DeliveryInputError("A route requires at least two points", 409);
  }

  let minimumDistance = Infinity;
  for (let index = 0; index < routePoints.length - 1; index += 1) {
    minimumDistance = Math.min(
      minimumDistance,
      pointToSegmentDistanceMeters(
        point,
        routePoints[index],
        routePoints[index + 1],
      ),
    );
  }
  return minimumDistance;
}

export function buildRoutePoints(trip) {
  try {
    return [
      normalizePoint(trip?.origin_lat, trip?.origin_lon),
      ...(Array.isArray(trip?.waypoints) ? trip.waypoints : []).map(
        (waypoint) => normalizePoint(waypoint?.lat, waypoint?.lon),
      ),
      normalizePoint(trip?.destination_lat, trip?.destination_lon),
    ];
  } catch {
    throw new DeliveryInputError("Trip coordinates are invalid", 409);
  }
}

export function resolveDeliveryPoints(request) {
  const hasPickup = (
    request?.pickup_lat != null && request?.pickup_lon != null
  );
  const pickup = tryNormalizePoint(
    hasPickup
      ? request.pickup_lat
      : request?.facility_lat ?? request?.flat,
    hasPickup
      ? request.pickup_lon
      : request?.facility_lon ?? request?.flon,
  );
  const dropoff = tryNormalizePoint(
    request?.dropoff_lat,
    request?.dropoff_lon,
  );
  return { pickup, dropoff };
}

export function hasOppositeDirection(first, second) {
  if (
    !first?.pickup
    || !first?.dropoff
    || !second?.pickup
    || !second?.dropoff
  ) {
    return false;
  }

  const firstVector = toLocalMeters(first.dropoff, first.pickup);
  const secondVector = toLocalMeters(second.dropoff, second.pickup);
  const firstMagnitude = Math.hypot(firstVector.x, firstVector.y);
  const secondMagnitude = Math.hypot(secondVector.x, secondVector.y);
  if (firstMagnitude === 0 || secondMagnitude === 0) return false;

  return (
    firstVector.x * secondVector.x + firstVector.y * secondVector.y
  ) < 0;
}
