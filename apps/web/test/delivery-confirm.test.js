import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/utils/sql", () => ({
  default: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

import sql from "@/app/api/utils/sql";
import { POST as confirmDelivery } from "@/app/api/delivery/confirm/route";
import { getAuthenticatedUser } from "@/lib/auth";

function request(body = { requestId: "delivery-1" }) {
  return new Request("http://localhost/api/delivery/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const activeCashDelivery = {
  id: "delivery-1",
  status: "in_transit",
  payment_method: "cash",
  cart_status: "confirmed",
};

describe("delivery confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue({ id: "courier-1" });
  });

  it("completes an owned cash delivery without returning a payout", async () => {
    sql
      .mockResolvedValueOnce([activeCashDelivery])
      .mockResolvedValueOnce([{
        id: "delivery-1",
        cart_completed: true,
        notification_created: true,
      }]);

    const response = await confirmDelivery(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("rejects historical escrow deliveries before mutation", async () => {
    sql.mockResolvedValueOnce([{
      ...activeCashDelivery,
      payment_method: "escrow",
    }]);

    const response = await confirmDelivery(request());

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "ESCROW_DISABLED",
    });
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("rejects a cart that is not ready for completion", async () => {
    sql.mockResolvedValueOnce([{
      ...activeCashDelivery,
      cart_status: "pending",
    }]);

    const response = await confirmDelivery(request());

    expect(response.status).toBe(409);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("makes repeated completion attempts fail safely", async () => {
    sql
      .mockResolvedValueOnce([activeCashDelivery])
      .mockResolvedValueOnce([]);

    const response = await confirmDelivery(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Delivery was already completed or changed",
    });
  });

  it("requires an authenticated courier", async () => {
    getAuthenticatedUser.mockResolvedValue(null);

    const response = await confirmDelivery(request());

    expect(response.status).toBe(401);
    expect(sql).not.toHaveBeenCalled();
  });
});
