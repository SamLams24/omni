import { describe, expect, it } from "vitest";
import {
  GeoValidationError,
  escapeLikePattern,
  normalizeGeoRow,
  parseNearbyParams,
  parseSearchTerm,
} from "@/app/api/discovery/geo";

describe("discovery geolocation validation", () => {
  it("accepts zero-valued coordinates and applies bounded defaults", () => {
    expect(parseNearbyParams({ lat: 0, lon: 0 })).toEqual({
      lat: 0,
      lon: 0,
      radius: 10000,
      limit: 50,
    });
  });

  it("accepts URL search parameters", () => {
    const params = new URLSearchParams({
      lat: "6.1319",
      lon: "1.2228",
      radius: "5000",
      limit: "25",
    });

    expect(parseNearbyParams(params)).toEqual({
      lat: 6.1319,
      lon: 1.2228,
      radius: 5000,
      limit: 25,
    });
  });

  it.each([
    [{ lon: 1 }, "Missing lat"],
    [{ lat: 6, lon: 181 }, "lon must be"],
    [{ lat: -91, lon: 1 }, "lat must be"],
    [{ lat: 6, lon: 1, radius: 50001 }, "radius must be"],
    [{ lat: 6, lon: 1, limit: 0 }, "limit must be"],
  ])("rejects invalid nearby input %#", (input, message) => {
    expect(() => parseNearbyParams(input)).toThrow(message);
  });

  it("rejects missing and oversized search terms", () => {
    expect(() => parseSearchTerm({ search: " " })).toThrow(
      GeoValidationError,
    );
    expect(() => parseSearchTerm({ search: "a".repeat(101) })).toThrow(
      "must not exceed 100",
    );
  });

  it("escapes SQL LIKE wildcard characters", () => {
    expect(escapeLikePattern("100%_bio\\local")).toBe(
      "100\\%\\_bio\\\\local",
    );
  });

  it("normalizes Postgres numeric values for map consumers", () => {
    expect(
      normalizeGeoRow({
        lat: "6.13",
        lon: "1.22",
        distance: "125.5",
        rating: "4.50",
        product_count: "3",
        review_count: "7",
        avg_price: "1250.00",
      }),
    ).toMatchObject({
      lat: 6.13,
      lon: 1.22,
      distance: 125.5,
      rating: 4.5,
      product_count: 3,
      review_count: 7,
      avg_price: 1250,
    });
  });
});
