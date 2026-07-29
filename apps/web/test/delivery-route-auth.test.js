import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const deliveryRouteFiles = [
  "../src/app/api/delivery/accept/route.js",
  "../src/app/api/delivery/available/route.js",
  "../src/app/api/delivery/confirm/route.js",
  "../src/app/api/delivery/history/route.js",
  "../src/app/api/delivery/location/[userId]/route.js",
  "../src/app/api/delivery/match/route.js",
  "../src/app/api/delivery/my-active/route.js",
  "../src/app/api/delivery/planned-trip/[id]/route.js",
  "../src/app/api/delivery/profile/route.js",
  "../src/app/api/delivery/register/route.js",
  "../src/app/api/delivery/request/route.js",
  "../src/app/api/delivery/toggle/route.js",
  "../src/app/api/delivery/tracking/[id]/route.js",
  "../src/app/api/delivery/trips/[id]/deactivate/route.js",
  "../src/app/api/delivery/trips/[id]/route.js",
  "../src/app/api/delivery/trips/active/route.js",
  "../src/app/api/delivery/trips/create/route.js",
  "../src/app/api/delivery/vehicles/[id]/route.js",
  "../src/app/api/delivery/vehicles/route.js",
  "../src/app/api/delivery/vehicles/switch/route.js",
];

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("delivery route authorization", () => {
  it.each(deliveryRouteFiles)(
    "%s relies on the server-validated session",
    (relativePath) => {
      const source = readSource(relativePath);

      expect(source).toContain("getAuthenticatedUser");
      expect(source).not.toContain("x-user-id");
    },
  );

  it("restricts matching and acceptance to owned active trips", () => {
    const matching = readSource("../src/app/api/delivery/match/route.js");
    const acceptance = readSource("../src/app/api/delivery/accept/route.js");

    expect(matching).toContain("dp.user_id = ${userId}");
    expect(matching).toContain("dpt.is_active = true");
    expect(acceptance).toContain("delivery_profile_id = ${profile[0].id}");
    expect(acceptance).toContain("Activate your delivery profile first");
  });

  it("uses shared delivery rules in route handlers", () => {
    const matching = readSource("../src/app/api/delivery/match/route.js");
    const acceptance = readSource("../src/app/api/delivery/accept/route.js");
    const createTrip = readSource(
      "../src/app/api/delivery/trips/create/route.js",
    );
    const updateTrip = readSource(
      "../src/app/api/delivery/trips/[id]/route.js",
    );

    expect(matching).toContain("distanceToRouteMeters");
    expect(acceptance).toContain("hasOppositeDirection");
    expect(createTrip).toContain("parseTripInput");
    expect(updateTrip).toContain("parseTripInput");
    expect(updateTrip).toContain("delivery_tier");
  });

  it("keeps simulated tracking disabled in production", () => {
    const tracking = readSource("../src/app/api/delivery/tracking/[id]/route.js");

    expect(tracking).toContain("ENABLE_MOCK_DELIVERY_TRACKING");
    expect(tracking).toContain("dr.buyer_id = ${userId}");
    expect(tracking).toContain("dr.delivery_profile_id");
  });

  it("does not return fabricated delivery locations or requests", () => {
    const location = readSource("../src/app/api/delivery/location/[userId]/route.js");
    const available = readSource("../src/app/api/delivery/available/route.js");

    expect(location).not.toContain("Math.random");
    expect(location).not.toContain("mock: true");
    expect(available).not.toContain("mockRequests");
    expect(available).toContain("FROM delivery_requests");
  });
});
