import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const financialRouteFiles = [
  "../src/app/api/escrow/dispute/route.js",
  "../src/app/api/escrow/refund/route.js",
  "../src/app/api/escrow/release/route.js",
  "../src/app/api/subscription/cancel/route.js",
  "../src/app/api/subscriptions/status/route.js",
  "../src/app/api/subscriptions/upgrade/route.js",
  "../src/app/api/wallet/balance/route.js",
  "../src/app/api/wallet/deposit/route.js",
  "../src/app/api/wallet/withdraw/route.js",
];

const financialClientFiles = [
  "../src/app/map/page.jsx",
  "../src/app/subscriptions/page.jsx",
  "../src/app/wallet/page.jsx",
  "../src/components/DepositModal.jsx",
  "../src/components/GlobalNav.jsx",
];

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("financial route authorization", () => {
  it.each(financialRouteFiles)(
    "%s relies on the server-validated session",
    (relativePath) => {
      const source = readSource(relativePath);

      expect(source).toContain("getAuthenticatedUser");
      expect(source).not.toContain("x-user-id");
    },
  );

  it.each(financialClientFiles)(
    "%s does not submit a client-selected user id",
    (relativePath) => {
      expect(readSource(relativePath)).not.toContain("x-user-id");
    },
  );

  it("keeps simulated financial mutations disabled in production", () => {
    for (const relativePath of financialRouteFiles.filter(
      (path) => !path.includes("/status/"),
    )) {
      expect(readSource(relativePath)).toContain(
        'requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS")',
      );
    }
  });

  it("restricts escrow actions to cart participants", () => {
    const dispute = readSource("../src/app/api/escrow/dispute/route.js");
    const refund = readSource("../src/app/api/escrow/refund/route.js");
    const release = readSource("../src/app/api/escrow/release/route.js");

    expect(dispute).toContain("c.buyer_id = ${userId}");
    expect(dispute).toContain("v.user_id = ${userId}");
    expect(refund).toContain("v.user_id = ${userId}");
    expect(release).toContain("c.buyer_id = ${userId}");
  });

  it("charges subscriptions before activating their tier", () => {
    const source = readSource("../src/app/api/subscriptions/upgrade/route.js");

    expect(source).toContain("WITH debited AS");
    expect(source).toContain("balance >= ${fee}");
    expect(source).toContain("EXISTS (SELECT 1 FROM subscribed)");
    expect(source).not.toContain("INSERT INTO users");
  });

  it("stores the vendor id, not the facility id, in escrow", () => {
    const source = readSource("../src/app/api/cart/respond/route.js");

    expect(source).toContain("INSERT INTO escrow_holds");
    expect(source).toContain("${cart.vendor_id}");
    expect(source).toContain("'escrow_hold', ${total}");
    expect(source).not.toContain("${cart.facility_id}, ${total}");
  });

  it("keeps the escrow schema and release transition aligned", () => {
    const schema = readSource("../scripts/create-tables.sql");
    const received = readSource("../src/app/api/cart/[id]/received/route.js");

    expect(schema).toContain("'held', 'disputed', 'released', 'refunded'");
    expect(received).toContain("SET status = 'released'");
  });
});
