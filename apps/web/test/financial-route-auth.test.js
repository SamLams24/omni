import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { POST as cancelSubscription } from "../src/app/api/subscription/cancel/route.js";
import { POST as upgradeSubscription } from "../src/app/api/subscriptions/upgrade/route.js";
import { POST as withdraw } from "../src/app/api/wallet/withdraw/route.js";
import { POST as disputeEscrow } from "../src/app/api/escrow/dispute/route.js";
import { POST as refundEscrow } from "../src/app/api/escrow/refund/route.js";
import { POST as releaseEscrow } from "../src/app/api/escrow/release/route.js";

const financialRouteFiles = [
  "../src/app/api/subscriptions/status/route.js",
  "../src/app/api/wallet/balance/route.js",
  "../src/app/api/wallet/deposit-intent/route.js",
  "../src/app/api/wallet/verify-fedapay/route.js",
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

  it.each([
    ["upgrade", upgradeSubscription],
    ["cancel", cancelSubscription],
  ])("keeps subscription %s mutations unavailable", async (_, handler) => {
    const response = await handler();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "SUBSCRIPTIONS_DISABLED",
    });
  });

  it("removes local subscription billing and activation", () => {
    const upgrade = readSource(
      "../src/app/api/subscriptions/upgrade/route.js",
    );
    const cancel = readSource("../src/app/api/subscription/cancel/route.js");
    const page = readSource("../src/app/subscriptions/page.jsx");

    for (const route of [upgrade, cancel]) {
      expect(route).not.toContain("UPDATE wallets");
      expect(route).not.toContain("UPDATE users");
      expect(route).not.toContain("INSERT INTO subscriptions");
      expect(route).not.toContain("ENABLE_MOCK_FINANCIAL_FLOWS");
    }
    expect(page).not.toContain('fetch("/api/subscriptions/upgrade"');
    expect(page).not.toContain("5 000 FCFA");
    expect(page).not.toContain("1 000 FCFA");
    expect(page).toContain("Bientôt disponible");
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

  it.each([
    ["dispute", disputeEscrow],
    ["refund", refundEscrow],
    ["release", releaseEscrow],
  ])("keeps escrow %s unavailable", async (_, handler) => {
    const response = await handler();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "ESCROW_DISABLED",
    });
  });

  it("removes simulated escrow mutations and client selection", () => {
    const escrowRoutes = ["dispute", "refund", "release"].map((action) =>
      readSource(`../src/app/api/escrow/${action}/route.js`)
    );
    const cartRoutes = [
      "../src/app/api/cart/respond/route.js",
      "../src/app/api/cart/[id]/received/route.js",
      "../src/app/api/cart/[id]/cancel/route.js",
    ].map(readSource);
    const deliveryConfirm = readSource(
      "../src/app/api/delivery/confirm/route.js",
    );
    const cartPanel = readSource("../src/components/CartPanel.jsx");

    for (const route of escrowRoutes) {
      expect(route).not.toContain("getAuthenticatedUser");
      expect(route).not.toContain("@/app/api/utils/sql");
    }
    for (const route of [...escrowRoutes, ...cartRoutes]) {
      expect(route).not.toContain("UPDATE wallets");
      expect(route).not.toContain("INSERT INTO escrow_holds");
      expect(route).not.toContain("ENABLE_MOCK_FINANCIAL_FLOWS");
    }
    expect(deliveryConfirm).toContain('code: "ESCROW_DISABLED"');
    expect(deliveryConfirm).not.toContain("UPDATE escrow_holds");
    expect(cartPanel).toContain('paymentMethod: "cash"');
    expect(cartPanel).not.toContain('setPaymentMethod("escrow")');
    expect(cartPanel).not.toContain("Balance disponible");
  });
});
