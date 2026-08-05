import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/utils/sql", () => ({
  default: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

import sql from "@/app/api/utils/sql";
import { POST as createDepositIntent } from "@/app/api/wallet/deposit-intent/route";
import { POST as verifyDeposit } from "@/app/api/wallet/verify-fedapay/route";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  FedaPayApiError,
  getFedaPayConfig,
  isValidFedaPayTransactionId,
  requestFedaPay,
} from "@/lib/fedapay";

const userId = "17ce39d2-d9f6-4ae5-80d6-a12889e6a40b";
const intentId = "91b81ce0-a414-4426-9de7-88acaadad238";

function postRequest(path, body) {
  return new Request(`https://omni.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function approvedTransaction(overrides = {}) {
  return {
    id: 42001,
    amount: 5000,
    status: "approved",
    custom_metadata: { omni_deposit_intent_id: intentId },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_test_example");
  vi.stubEnv("FEDAPAY_ENVIRONMENT", "sandbox");
  getAuthenticatedUser.mockResolvedValue({ id: userId });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("FedaPay server client", () => {
  it("uses only the documented fixed API environments", () => {
    expect(getFedaPayConfig()).toMatchObject({
      baseUrl: "https://sandbox-api.fedapay.com/v1",
      environment: "sandbox",
    });

    vi.stubEnv("FEDAPAY_ENVIRONMENT", "live");
    expect(getFedaPayConfig().baseUrl).toBe("https://api.fedapay.com/v1");

    vi.stubEnv("FEDAPAY_ENVIRONMENT", "https://attacker.test");
    expect(() => getFedaPayConfig()).toThrow(FedaPayApiError);
  });

  it("accepts only positive decimal transaction identifiers", () => {
    expect(isValidFedaPayTransactionId("42001")).toBe(true);
    expect(isValidFedaPayTransactionId("0")).toBe(false);
    expect(isValidFedaPayTransactionId("42.json")).toBe(false);
    expect(isValidFedaPayTransactionId("42/../../users")).toBe(false);
    expect(isValidFedaPayTransactionId(42001)).toBe(false);
  });

  it("never exposes provider response bodies when an API call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("secret provider details", { status: 401 }),
      ),
    );

    await expect(requestFedaPay("/transactions/42001")).rejects.toMatchObject({
      message: "FedaPay request failed with status 401",
      status: 502,
    });
  });
});

describe("FedaPay deposit intent", () => {
  it("requires a server-authenticated user", async () => {
    getAuthenticatedUser.mockResolvedValue(null);

    const response = await createDepositIntent(
      postRequest("/api/wallet/deposit-intent", { amount: 5000 }),
    );

    expect(response.status).toBe(401);
    expect(sql).not.toHaveBeenCalled();
  });

  it.each([99, 100.5, 1_000_001, "5000", "not-a-number"])(
    "rejects an invalid amount: %s",
    async (amount) => {
      const response = await createDepositIntent(
        postRequest("/api/wallet/deposit-intent", { amount }),
      );

      expect(response.status).toBe(400);
      expect(sql).not.toHaveBeenCalled();
    },
  );

  it("creates the provider transaction on the server and binds its metadata", async () => {
    sql
      .mockResolvedValueOnce([{ id: intentId }])
      .mockResolvedValueOnce([{ id: intentId }]);
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ id: 42001, amount: 5000, status: "pending" }, { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await createDepositIntent(
      postRequest("/api/wallet/deposit-intent", { amount: 5000 }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      intentId,
      transactionId: "42001",
      amount: 5000,
      currency: "XOF",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sandbox-api.fedapay.com/v1/transactions",
      expect.objectContaining({ method: "POST" }),
    );
    const providerBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(providerBody).toMatchObject({
      amount: 5000,
      currency: { iso: "XOF" },
      custom_metadata: { omni_deposit_intent_id: intentId },
    });
  });

  it("rate-limits provider transaction creation through the database", async () => {
    sql.mockResolvedValueOnce([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await createDepositIntent(
      postRequest("/api/wallet/deposit-intent", { amount: 5000 }),
    );

    expect(response.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sql.mock.calls[0][0].join(" ")).toContain("INTERVAL '1 minute'");
  });
});

describe("FedaPay deposit settlement", () => {
  it("does not query FedaPay for a transaction unbound to the user", async () => {
    sql.mockResolvedValueOnce([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await verifyDeposit(
      postRequest("/api/wallet/verify-fedapay", { transactionId: "42001" }),
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it.each(["pending", "paid", "completed", "canceled"])(
    "refuses provider status %s",
    async (status) => {
      sql.mockResolvedValueOnce([{
        id: intentId,
        amount: "5000.00",
        currency: "XOF",
        status: "pending",
      }]);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(Response.json(approvedTransaction({ status }))),
      );

      const response = await verifyDeposit(
        postRequest("/api/wallet/verify-fedapay", { transactionId: "42001" }),
      );

      expect(response.status).toBe(409);
      expect(sql).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects a transaction whose server-created metadata does not match", async () => {
    sql.mockResolvedValueOnce([{
      id: intentId,
      amount: "5000.00",
      currency: "XOF",
      status: "pending",
    }]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(approvedTransaction({
          custom_metadata: { omni_deposit_intent_id: "another-intent" },
        })),
      ),
    );

    const response = await verifyDeposit(
      postRequest("/api/wallet/verify-fedapay", { transactionId: "42001" }),
    );

    expect(response.status).toBe(403);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("records the ledger entry before crediting exactly the confirmed amount", async () => {
    sql
      .mockResolvedValueOnce([{
        id: intentId,
        amount: "5000.00",
        currency: "XOF",
        status: "pending",
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        balance: "7500.00",
        claimed: true,
        recorded: true,
      }]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(approvedTransaction())),
    );

    const response = await verifyDeposit(
      postRequest("/api/wallet/verify-fedapay", { transactionId: "42001" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      balance: 7500,
      amount: 5000,
      currency: "XOF",
    });
    const settlementSql = sql.mock.calls[2][0].join(" ");
    expect(settlementSql.indexOf("recorded_tx AS")).toBeLessThan(
      settlementSql.indexOf("credited_wallet AS"),
    );
    expect(settlementSql).toContain(
      "ON CONFLICT (reference) WHERE reference IS NOT NULL DO NOTHING",
    );
  });

  it("returns the current balance without contacting FedaPay after settlement", async () => {
    sql
      .mockResolvedValueOnce([{
        id: intentId,
        amount: "5000.00",
        currency: "XOF",
        status: "settled",
      }])
      .mockResolvedValueOnce([{ balance: "7500.00" }]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await verifyDeposit(
      postRequest("/api/wallet/verify-fedapay", { transactionId: "42001" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      message: "Transaction already processed",
      balance: 7500,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
