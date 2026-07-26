import { describe, expect, it } from "vitest";
import {
  buildRoutePoints,
  distanceToRouteMeters,
  hasOppositeDirection,
  haversineDistanceMeters,
  interpolateRoutePosition,
  pointToSegmentDistanceMeters,
  resolveDeliveryPoints,
} from "@/domains/delivery/geo";
import {
  parseDeliveryActionInput,
  parseTripInput,
} from "@/domains/delivery/input";

const validTrip = {
  originLat: 6.125,
  originLon: 1.225,
  destinationLat: 6.225,
  destinationLon: 1.325,
  deviationKm: 2,
};

describe("delivery trip input", () => {
  it("normalizes coordinates and waypoints", () => {
    expect(parseTripInput({
      ...validTrip,
      originLat: "6.125",
      waypoints: [{ lat: "6.15", lon: "1.25", address: "Adidogomé" }],
    })).toEqual({
      origin: { lat: 6.125, lon: 1.225 },
      destination: { lat: 6.225, lon: 1.325 },
      waypoints: [{ lat: 6.15, lon: 1.25, address: "Adidogomé" }],
      deviationKm: 2,
      departureTime: null,
    });
  });

  it("accepts valid zero coordinates", () => {
    const result = parseTripInput({
      originLat: 0,
      originLon: 0,
      destinationLat: 1,
      destinationLon: 1,
    });

    expect(result.origin).toEqual({ lat: 0, lon: 0 });
  });

  it.each([
    [{ ...validTrip, originLat: 91 }],
    [{ ...validTrip, originLon: -181 }],
    [{ ...validTrip, destinationLat: "" }],
    [{ ...validTrip, destinationLon: "invalid" }],
  ])("rejects missing or out-of-range endpoints", (input) => {
    expect(() => parseTripInput(input))
      .toThrow("origin and destination required");
  });

  it("rejects malformed waypoints", () => {
    expect(() => parseTripInput({ ...validTrip, waypoints: "Lomé" }))
      .toThrow("Waypoints must be an array");
    expect(() =>
      parseTripInput({
        ...validTrip,
        waypoints: [{ lat: 6.1, lon: 181 }],
      }),
    ).toThrow("Waypoint coordinates are invalid");
  });

  it("limits a trip to the five waypoints supported by the UI", () => {
    expect(() =>
      parseTripInput({
        ...validTrip,
        waypoints: Array.from(
          { length: 6 },
          (_, index) => ({ lat: 6 + index / 100, lon: 1.2 }),
        ),
      }),
    ).toThrow("more than 5 waypoints");
  });

  it.each([-1, 10.5, "invalid"])(
    "rejects invalid deviation %s",
    (deviationKm) => {
      expect(() => parseTripInput({ ...validTrip, deviationKm }))
        .toThrow("between 0 and 10");
    },
  );

  it("enforces the free-tier route restrictions", () => {
    const result = parseTripInput({
      ...validTrip,
      deviationKm: 8,
      waypoints: [{ lat: 6.15, lon: 1.25 }],
    }, { freeTier: true });

    expect(result.waypoints).toEqual([]);
    expect(result.deviationKm).toBe(2);
  });

  it("validates required action identifiers", () => {
    expect(parseDeliveryActionInput(
      { requestId: "request-1", tripId: "trip-1" },
      ["requestId", "tripId"],
    )).toEqual({ requestId: "request-1", tripId: "trip-1" });
    expect(() =>
      parseDeliveryActionInput({ tripId: "trip-1" }, ["requestId", "tripId"]),
    ).toThrow("requestId and tripId required");
  });
});

describe("delivery route geometry", () => {
  it("computes geodesic distance in metres", () => {
    const distance = haversineDistanceMeters(
      { lat: 6.125, lon: 1.225 },
      { lat: 6.135, lon: 1.225 },
    );

    expect(distance).toBeGreaterThan(1100);
    expect(distance).toBeLessThan(1125);
  });

  it("computes the closest distance to a route segment", () => {
    const distance = pointToSegmentDistanceMeters(
      { lat: 6.13, lon: 1.23 },
      { lat: 6.12, lon: 1.22 },
      { lat: 6.14, lon: 1.22 },
    );

    expect(distance).toBeGreaterThan(1090);
    expect(distance).toBeLessThan(1120);
  });

  it("finds the closest segment in a multi-point route", () => {
    const distance = distanceToRouteMeters(
      { lat: 6.2, lon: 1.31 },
      [
        { lat: 6.1, lon: 1.2 },
        { lat: 6.2, lon: 1.2 },
        { lat: 6.2, lon: 1.3 },
      ],
    );

    expect(distance).toBeGreaterThan(1090);
    expect(distance).toBeLessThan(1120);
  });

  it("normalizes database route coordinates", () => {
    expect(buildRoutePoints({
      origin_lat: "6.1",
      origin_lon: "1.2",
      destination_lat: "6.3",
      destination_lon: "1.4",
      waypoints: [{ lat: "6.2", lon: "1.3" }],
    })).toEqual([
      { lat: 6.1, lon: 1.2 },
      { lat: 6.2, lon: 1.3 },
      { lat: 6.3, lon: 1.4 },
    ]);
  });

  it("preserves zero pickup coordinates instead of using the fallback", () => {
    expect(resolveDeliveryPoints({
      pickup_lat: 0,
      pickup_lon: 0,
      facility_lat: 6.1,
      facility_lon: 1.2,
      dropoff_lat: 1,
      dropoff_lon: 1,
    }).pickup).toEqual({ lat: 0, lon: 0 });
  });

  it("uses facility coordinates only when pickup is absent", () => {
    expect(resolveDeliveryPoints({
      pickup_lat: null,
      pickup_lon: null,
      facility_lat: "6.1",
      facility_lon: "1.2",
    }).pickup).toEqual({ lat: 6.1, lon: 1.2 });
  });

  it("does not combine partial pickup and facility coordinates", () => {
    expect(resolveDeliveryPoints({
      pickup_lat: 6.5,
      pickup_lon: null,
      facility_lat: 6.1,
      facility_lon: 1.2,
    }).pickup).toEqual({ lat: 6.1, lon: 1.2 });
  });

  it("detects deliveries travelling in opposite directions", () => {
    const eastbound = {
      pickup: { lat: 6.1, lon: 1.2 },
      dropoff: { lat: 6.1, lon: 1.3 },
    };
    const westbound = {
      pickup: { lat: 6.1, lon: 1.3 },
      dropoff: { lat: 6.1, lon: 1.2 },
    };
    const northbound = {
      pickup: { lat: 6.1, lon: 1.2 },
      dropoff: { lat: 6.2, lon: 1.2 },
    };

    expect(hasOppositeDirection(eastbound, westbound)).toBe(true);
    expect(hasOppositeDirection(eastbound, northbound)).toBe(false);
  });

  it("interpolates and clamps mock tracking positions", () => {
    const route = [
      { lat: 0, lon: 0 },
      { lat: 1, lon: 1 },
      { lat: 2, lon: 0 },
    ];

    expect(interpolateRoutePosition(route, 0.25)).toEqual({
      lat: 0.5,
      lon: 0.5,
    });
    expect(interpolateRoutePosition(route, 2)).toEqual({ lat: 2, lon: 0 });
  });
});
