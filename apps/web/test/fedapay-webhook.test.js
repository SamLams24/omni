import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/utils/sql", () => ({
  default: vi.fn(),
}));
vi.mock("@/lib/wallet-deposits", () => ({
  settleFedaPayDeposit: vi.fn(),
}));

import sql from "@/app/api/utils/sql";
import { POST } from "@/app/api/webhooks/fedapay/route";
import { FedaPayApiError } from "@/lib/fedapay";
import {
  constructFedaPayWebhookEvent,
  FedaPayWebhookError,
  getFedaPayEventId,
  getFedaPayEventName,
  getFedaPayEventTransactionId,
} from "@/lib/fedapay-webhook";
import { settleFedaPayDeposit } from "@/lib/wallet-deposits";

const secret = "wh_sandbox_test_secret";
const nowSeconds = 1_800_000_000;

function signature(rawBody, timestamp = nowSeconds) {
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  return `t=${timestamp},s=${digest}`;
}

function webhookRequest(event, options = {}) {
  const rawBody = options.rawBody ?? JSON.stringify(event);
  return new Request("https://omni.test/api/webhooks/fedapay", {
    method: "POST",
    headers: {
      "Content-Type": options.contentType ?? "application/json",
      "X-FEDAPAY-SIGNATURE": options.signature ?? signature(
        rawBody,
        Math.floor(Date.now() / 1000),
      ),
    },
    body: rawBody,
  });
}

function approvedEvent(overrides = {}) {
  return {
    id: "evt_approved_42001",
    name: "transaction.approved",
    object_id: 42001,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", secret);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("FedaPay webhook signature verification", () => {
  it("accepts an authentic raw payload within the tolerance window", () => {
    const rawBody = JSON.stringify(approvedEvent());

    expect(
      constructFedaPayWebhookEvent(rawBody, signature(rawBody), secret, {
        nowSeconds,
      }),
    ).toEqual(approvedEvent());
  });

  it("rejects tampered payloads with a timing-safe signature comparison", () => {
    const original = JSON.stringify(approvedEvent());
    const tampered = JSON.stringify(approvedEvent({ object_id: 99999 }));

    expect(() => constructFedaPayWebhookEvent(
      tampered,
      signature(original),
      secret,
      { nowSeconds },
    )).toThrow(FedaPayWebhookError);
  });

  it.each([
    nowSeconds - 301,
    nowSeconds + 301,
  ])("rejects stale or future timestamps: %s", (timestamp) => {
    const rawBody = JSON.stringify(approvedEvent());

    expect(() => constructFedaPayWebhookEvent(
      rawBody,
      signature(rawBody, timestamp),
      secret,
      { nowSeconds },
    )).toThrow("Webhook timestamp outside tolerance");
  });

  it("verifies the signature before parsing JSON", () => {
    const rawBody = "{invalid";

    expect(() => constructFedaPayWebhookEvent(
      rawBody,
      signature(rawBody),
      secret,
      { nowSeconds },
    )).toThrow("Invalid webhook JSON");
  });

  it("supports current and legacy FedaPay event field names", () => {
    expect(getFedaPayEventName({ name: "transaction.approved" })).toBe(
      "transaction.approved",
    );
    expect(getFedaPayEventName({ type: "transaction.approved" })).toBe(
      "transaction.approved",
    );
    expect(getFedaPayEventId({ id: 123 })).toBe("123");
    expect(getFedaPayEventTransactionId({ object_id: 42001 })).toBe("42001");
    expect(getFedaPayEventTransactionId({ entity: { id: 42001 } })).toBe("42001");
  });
});

describe("POST /api/webhooks/fedapay", () => {
  it("fails closed when the endpoint secret is missing", async () => {
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "");

    const response = await POST(webhookRequest(approvedEvent()));

    expect(response.status).toBe(503);
    expect(sql).not.toHaveBeenCalled();
    expect(settleFedaPayDeposit).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature before touching the database", async () => {
    const response = await POST(webhookRequest(approvedEvent(), {
      signature: `t=${Math.floor(Date.now() / 1000)},s=${"0".repeat(64)}`,
    }));

    expect(response.status).toBe(400);
    expect(sql).not.toHaveBeenCalled();
    expect(settleFedaPayDeposit).not.toHaveBeenCalled();
  });

  it("acknowledges unrelated signed events without processing them", async () => {
    const response = await POST(webhookRequest(approvedEvent({
      name: "transaction.created",
    })));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      ignored: true,
    });
    expect(sql).not.toHaveBeenCalled();
  });

  it("persists and settles an approved transaction exactly once", async () => {
    sql
      .mockResolvedValueOnce([{ id: "webhook-row-1", status: "received" }])
      .mockResolvedValueOnce([]);
    settleFedaPayDeposit.mockResolvedValue({
      ok: true,
      alreadyProcessed: false,
    });

    const response = await POST(webhookRequest(approvedEvent()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      processed: true,
      duplicate: false,
    });
    expect(settleFedaPayDeposit).toHaveBeenCalledWith({
      transactionId: "42001",
    });
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("acknowledges a replay of an already processed event", async () => {
    sql.mockResolvedValueOnce([{
      id: "webhook-row-1",
      status: "processed",
    }]);

    const response = await POST(webhookRequest(approvedEvent()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      duplicate: true,
    });
    expect(settleFedaPayDeposit).not.toHaveBeenCalled();
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("requests a retry when provider verification is not yet consistent", async () => {
    sql
      .mockResolvedValueOnce([{ id: "webhook-row-1", status: "received" }])
      .mockResolvedValueOnce([]);
    settleFedaPayDeposit.mockResolvedValue({
      ok: false,
      code: "not_approved",
    });

    const response = await POST(webhookRequest(approvedEvent()));

    expect(response.status).toBe(503);
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("records a retryable provider outage without leaking details", async () => {
    sql
      .mockResolvedValueOnce([{ id: "webhook-row-1", status: "received" }])
      .mockResolvedValueOnce([]);
    settleFedaPayDeposit.mockRejectedValue(
      new FedaPayApiError("provider secret response"),
    );

    const response = await POST(webhookRequest(approvedEvent()));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Webhook processing unavailable",
    });
    expect(sql).toHaveBeenCalledTimes(2);
  });
});
