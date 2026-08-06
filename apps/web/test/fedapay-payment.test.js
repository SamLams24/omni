import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FedaPay, Transaction } from "fedapay";

vi.mock("@/app/api/utils/sql", () => ({
  default: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

import sql from "@/app/api/utils/sql";
import { POST as createDepositIntent } from "@/app/api/wallet/deposit-intent/route";
import { GET as getDepositStatus } from "@/app/api/wallet/fedapay-status/route";
import { POST as verifyDeposit } from "@/app/api/wallet/verify-fedapay/route";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  FedaPayApiError,
  getFedaPayConfig,
  getFedaPayPaymentState,
  isValidFedaPayTransactionId,
  normalizeTogoPhoneNumber,
  retrieveFedaPayTransaction,
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

function depositRequest(amount, phoneNumber = "+228 90 00 00 00") {
  return postRequest("/api/wallet/deposit-intent", { amount, phoneNumber });
}

function pendingTransaction(overrides = {}) {
  return {
    id: 42001,
    amount: 5000,
    status: "pending",
    generateToken: vi.fn().mockResolvedValue({
      token: "payment-token",
      url: "https://process.fedapay.com/payment-token",
    }),
    sendNowWithToken: vi.fn().mockResolvedValue({ message: "success" }),
    ...overrides,
  };
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
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("FedaPay server client", () => {
  it("pins the official SDK to the current Axios security override", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );
    const workspace = readFileSync(
      resolve(process.cwd(), "pnpm-workspace.yaml"),
      "utf8",
    );

    expect(packageJson.dependencies.fedapay).toBe("1.2.5");
    expect(packageJson.dependencies.axios).toBe("1.19.0");
    expect(workspace).toContain('"fedapay>axios": "1.19.0"');
  });

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

  it("normalizes Togo phone numbers and maps provider statuses", () => {
    expect(normalizeTogoPhoneNumber("+228 90-00-00-00")).toBe("90000000");
    expect(normalizeTogoPhoneNumber("00228 90 00 00 00")).toBe("90000000");
    expect(normalizeTogoPhoneNumber("1234")).toBeNull();
    expect(getFedaPayPaymentState("approved")).toBe("approved");
    expect(getFedaPayPaymentState("declined")).toBe("failed");
    expect(getFedaPayPaymentState("pending")).toBe("pending");
  });

  it("configures the official SDK without exposing provider errors", async () => {
    const setApiKey = vi.spyOn(FedaPay, "setApiKey");
    const setEnvironment = vi.spyOn(FedaPay, "setEnvironment");
    vi.spyOn(Transaction, "retrieve").mockRejectedValue(
      new Error("secret provider details"),
    );

    await expect(retrieveFedaPayTransaction("42001")).rejects.toMatchObject({
      message: "FedaPay request could not be completed",
      status: 502,
    });
    expect(setApiKey).toHaveBeenCalledWith("sk_test_example");
    expect(setEnvironment).toHaveBeenCalledWith("sandbox");
  });
});

describe("FedaPay deposit intent", () => {
  it("requires a server-authenticated user", async () => {
    getAuthenticatedUser.mockResolvedValue(null);

    const response = await createDepositIntent(
      depositRequest(5000),
    );

    expect(response.status).toBe(401);
    expect(sql).not.toHaveBeenCalled();
  });

  it.each([99, 100.5, 1_000_001, "5000", "not-a-number"])(
    "rejects an invalid amount: %s",
    async (amount) => {
      const response = await createDepositIntent(
        depositRequest(amount),
      );

      expect(response.status).toBe(400);
      expect(sql).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid Togo Mobile Money number", async () => {
    const response = await createDepositIntent(depositRequest(5000, "1234"));

    expect(response.status).toBe(400);
    expect(sql).not.toHaveBeenCalled();
  });

  it("creates the transaction and sends the Moov Togo push first", async () => {
    sql
      .mockResolvedValueOnce([{ id: intentId }])
      .mockResolvedValueOnce([{ id: intentId }]);
    const transaction = pendingTransaction();
    const createTransaction = vi.spyOn(Transaction, "create").mockResolvedValue(transaction);

    const response = await createDepositIntent(depositRequest(5000));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      intentId,
      transactionId: "42001",
      amount: 5000,
      currency: "XOF",
      flow: "mobile_money_push",
      checkoutUrl: "https://process.fedapay.com/payment-token",
    });
    expect(createTransaction).toHaveBeenCalledWith({
      amount: 5000,
      currency: { iso: "XOF" },
      description: "Recharge portefeuille Omni - 5000 FCFA",
      callback_url: "https://omni.test/wallet?payment=fedapay",
      custom_metadata: { omni_deposit_intent_id: intentId },
    });
    expect(transaction.generateToken).toHaveBeenCalledOnce();
    expect(transaction.sendNowWithToken).toHaveBeenCalledWith(
      "moov_tg",
      "payment-token",
      { phone_number: { number: "90000000", country: "tg" } },
    );
  });

  it("falls back to the hosted page on a push error without creating a second transaction", async () => {
    sql
      .mockResolvedValueOnce([{ id: intentId }])
      .mockResolvedValueOnce([{ id: intentId }]);
    const transaction = pendingTransaction({
      sendNowWithToken: vi.fn().mockRejectedValue(new Error("operator unavailable")),
    });
    const createTransaction = vi.spyOn(Transaction, "create").mockResolvedValue(transaction);

    const response = await createDepositIntent(depositRequest(5000));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      transactionId: "42001",
      flow: "hosted_checkout",
      checkoutUrl: "https://process.fedapay.com/payment-token",
    });
    expect(createTransaction).toHaveBeenCalledOnce();
  });

  it("rate-limits provider transaction creation through the database", async () => {
    sql.mockResolvedValueOnce([]);
    const createTransaction = vi.spyOn(Transaction, "create");

    const response = await createDepositIntent(
      depositRequest(5000),
    );

    expect(response.status).toBe(429);
    expect(createTransaction).not.toHaveBeenCalled();
    expect(sql.mock.calls[0][0].join(" ")).toContain("INTERVAL '1 minute'");
  });
});

describe("FedaPay push status", () => {
  function statusRequest(transactionId = "42001") {
    return new Request(
      `https://omni.test/api/wallet/fedapay-status?transactionId=${transactionId}`,
    );
  }

  it("does not query a transaction that is not bound to the user", async () => {
    sql.mockResolvedValueOnce([]);
    const retrieveTransaction = vi.spyOn(Transaction, "retrieve");

    const response = await getDepositStatus(statusRequest());

    expect(response.status).toBe(404);
    expect(retrieveTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ["pending", "pending"],
    ["approved", "approved"],
    ["declined", "failed"],
    ["canceled", "failed"],
    ["expired", "failed"],
  ])("maps provider status %s to %s", async (providerStatus, paymentState) => {
    sql.mockResolvedValueOnce([{ id: intentId }]);
    vi.spyOn(Transaction, "retrieve").mockResolvedValue({
      id: 42001,
      status: providerStatus,
    });

    const response = await getDepositStatus(statusRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, paymentState });
  });
});

describe("FedaPay deposit settlement", () => {
  it("does not query FedaPay for a transaction unbound to the user", async () => {
    sql.mockResolvedValueOnce([]);
    const retrieveTransaction = vi.spyOn(Transaction, "retrieve");

    const response = await verifyDeposit(
      postRequest("/api/wallet/verify-fedapay", { transactionId: "42001" }),
    );

    expect(response.status).toBe(404);
    expect(retrieveTransaction).not.toHaveBeenCalled();
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
      vi.spyOn(Transaction, "retrieve").mockResolvedValue(
        approvedTransaction({ status }),
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
    vi.spyOn(Transaction, "retrieve").mockResolvedValue(
      approvedTransaction({
        custom_metadata: { omni_deposit_intent_id: "another-intent" },
      }),
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
    vi.spyOn(Transaction, "retrieve").mockResolvedValue(approvedTransaction());

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
    const retrieveTransaction = vi.spyOn(Transaction, "retrieve");

    const response = await verifyDeposit(
      postRequest("/api/wallet/verify-fedapay", { transactionId: "42001" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      message: "Transaction already processed",
      balance: 7500,
    });
    expect(retrieveTransaction).not.toHaveBeenCalled();
  });
});
