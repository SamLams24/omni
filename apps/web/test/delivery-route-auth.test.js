import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GET as getDeliveryTracking,
} from "../src/app/api/delivery/tracking/[id]/route.js";

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

  it("removes simulated delivery tracking", async () => {
    const tracking = readSource("../src/app/api/delivery/tracking/[id]/route.js");
    const response = await getDeliveryTracking();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "DELIVERY_TRACKING_UNAVAILABLE",
    });
    expect(tracking).not.toContain("Date.now");
    expect(tracking).not.toContain("trackingPositions");
    expect(tracking).not.toContain("interpolateRoutePosition");
    expect(tracking).not.toContain("ENABLE_MOCK_DELIVERY_TRACKING");
    expect(tracking).not.toContain("@/app/api/utils/sql");
  });

  it("does not return fabricated delivery locations or requests", () => {
    const location = readSource("../src/app/api/delivery/location/[userId]/route.js");
    const available = readSource("../src/app/api/delivery/available/route.js");

    expect(location).not.toContain("Math.random");
    expect(location).not.toContain("mock: true");
    expect(available).not.toContain("mockRequests");
    expect(available).toContain("FROM delivery_requests");
  });

  it("completes deliveries without simulated wallet settlement", () => {
    const confirmation = readSource(
      "../src/app/api/delivery/confirm/route.js",
    );

    expect(confirmation).toContain("WITH delivered AS");
    expect(confirmation).toContain("completed_cart AS");
    expect(confirmation).toContain("c.payment_method = 'cash'");
    expect(confirmation).toContain("c.status IN ('confirmed', 'partial')");
    expect(confirmation).not.toContain("UPDATE wallets");
    expect(confirmation).not.toContain("INSERT INTO transactions");
    expect(confirmation).not.toContain("delivery_payment");
    expect(confirmation).not.toContain("ENABLE_MOCK_FINANCIAL_FLOWS");
    expect(confirmation).not.toContain("deliveryFee });");
  });
});
