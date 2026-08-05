import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { POST as withdraw } from "../src/app/api/wallet/withdraw/route.js";

const financialRouteFiles = [
  "../src/app/api/escrow/dispute/route.js",
  "../src/app/api/escrow/refund/route.js",
  "../src/app/api/escrow/release/route.js",
  "../src/app/api/subscription/cancel/route.js",
  "../src/app/api/subscriptions/status/route.js",
  "../src/app/api/subscriptions/upgrade/route.js",
  "../src/app/api/wallet/balance/route.js",
  "../src/app/api/wallet/deposit-intent/route.js",
  "../src/app/api/wallet/verify-fedapay/route.js",
];

const simulatedFinancialMutationFiles = [
  "../src/app/api/escrow/dispute/route.js",
  "../src/app/api/escrow/refund/route.js",
  "../src/app/api/escrow/release/route.js",
  "../src/app/api/subscription/cancel/route.js",
  "../src/app/api/subscriptions/upgrade/route.js",
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
    for (const relativePath of simulatedFinancialMutationFiles) {
      expect(readSource(relativePath)).toContain(
        'requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS")',
      );
    }
  });

  it("keeps the legacy deposit endpoint disabled", () => {
    const source = readSource("../src/app/api/wallet/deposit/route.js");

    expect(source).toContain('code: "FEATURE_DISABLED"');
    expect(source).not.toContain("INSERT INTO wallets");
  });

  it("removes the simulated withdrawal mutation", async () => {
    const route = readSource("../src/app/api/wallet/withdraw/route.js");
    const walletPage = readSource("../src/app/wallet/page.jsx");
    const response = await withdraw();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "WITHDRAWALS_DISABLED",
    });
    expect(route).toContain('code: "WITHDRAWALS_DISABLED"');
    expect(route).toContain('"Cache-Control": "no-store"');
    expect(route).not.toContain("UPDATE wallets");
    expect(route).not.toContain("INSERT INTO transactions");
    expect(route).not.toContain("ENABLE_MOCK_FINANCIAL_FLOWS");
    expect(walletPage).not.toContain('fetch("/api/wallet/withdraw"');
    expect(walletPage).not.toContain("Retirer");
  });

  it("settles only server-created FedaPay deposit intents", () => {
    const createIntent = readSource(
      "../src/app/api/wallet/deposit-intent/route.js",
    );
    const verify = readSource("../src/app/api/wallet/verify-fedapay/route.js");
    const settlement = readSource("../src/lib/wallet-deposits.js");

    expect(createIntent).toContain("omni_deposit_intent_id");
    expect(createIntent).toContain('currency: { iso: "XOF" }');
    expect(verify).toContain("settleFedaPayDeposit");
    expect(settlement).toContain('transaction.status !== "approved"');
    expect(settlement).toContain("Transaction ownership mismatch");
    expect(settlement).toContain("ON CONFLICT (user_id) DO NOTHING");
    expect(settlement).toContain("claimed_intent AS");
    expect(settlement).toContain("recorded_tx AS");
    expect(settlement).toContain("credited_wallet AS");
    expect(settlement).toContain(
      "ON CONFLICT (reference) WHERE reference IS NOT NULL DO NOTHING",
    );
    expect(settlement).not.toContain("completed");
    expect(settlement).not.toContain('"paid"');
  });

  it("authenticates FedaPay webhooks before reusing deposit settlement", () => {
    const webhook = readSource(
      "../src/app/api/webhooks/fedapay/route.js",
    );

    expect(webhook).toContain("request.text()");
    expect(webhook).toContain('request.headers.get("x-fedapay-signature")');
    expect(webhook).toContain("constructFedaPayWebhookEvent");
    expect(webhook).toContain("settleFedaPayDeposit");
    expect(webhook).not.toContain("request.json()");
    expect(webhook).not.toContain("getAuthenticatedUser");
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
    const schema = readSource("../db/migrations/0001_baseline.sql");
    const received = readSource("../src/app/api/cart/[id]/received/route.js");

    expect(schema).toContain("'held', 'disputed', 'released', 'refunded'");
    expect(received).toContain("SET status = 'released'");
  });
});
