import { describe, expect, it } from "vitest";
import { buildCartResponse } from "@/domains/cart/response";

const requests = [
  {
    id: "request-1",
    status: "pending",
    quantity_requested: 2,
    price: 1000,
  },
  {
    id: "request-2",
    status: "pending",
    quantity_requested: 3,
    price: 500,
  },
];

describe("cart response state", () => {
  it("confirms every item and computes the escrow total", () => {
    expect(
      buildCartResponse(requests, { confirmAll: true }),
    ).toMatchObject({
      cartStatus: "confirmed",
      total: 3500,
      fee: 35,
    });
  });

  it("derives a partial cart from the complete response set", () => {
    const result = buildCartResponse(requests, {
      items: [
        {
          requestId: "request-1",
          status: "confirmed",
          quantityConfirmed: 1,
        },
        {
          requestId: "request-2",
          status: "denied",
          quantityConfirmed: 0,
        },
      ],
    });

    expect(result.cartStatus).toBe("partial");
    expect(result.total).toBe(1000);
    expect(result.responses[1].quantity_confirmed).toBeNull();
  });

  it("derives a denied cart when no item is available", () => {
    const result = buildCartResponse(requests, {
      items: requests.map((item) => ({
        requestId: item.id,
        status: "denied",
        quantityConfirmed: 0,
      })),
    });

    expect(result.cartStatus).toBe("denied");
    expect(result.total).toBe(0);
    expect(result.fee).toBe(0);
  });

  it("requires one response for every item", () => {
    expect(() =>
      buildCartResponse(requests, {
        items: [
          {
            requestId: "request-1",
            status: "confirmed",
            quantityConfirmed: 1,
          },
        ],
      }),
    ).toThrow("every cart item");
  });

  it("rejects duplicate response identifiers", () => {
    expect(() =>
      buildCartResponse(requests, {
        items: [
          {
            requestId: "request-1",
            status: "confirmed",
            quantityConfirmed: 1,
          },
          {
            requestId: "request-1",
            status: "denied",
            quantityConfirmed: 0,
          },
        ],
      }),
    ).toThrow("invalid or duplicate");
  });

  it("rejects confirmed quantities above the requested quantity", () => {
    expect(() =>
      buildCartResponse(requests, {
        items: [
          {
            requestId: "request-1",
            status: "confirmed",
            quantityConfirmed: 3,
          },
          {
            requestId: "request-2",
            status: "denied",
            quantityConfirmed: 0,
          },
        ],
      }),
    ).toThrow("between 1 and the requested quantity");
  });

  it("rejects a cart containing a non-pending item", () => {
    expect(() =>
      buildCartResponse(
        [{ ...requests[0], status: "queued" }, requests[1]],
        { confirmAll: true },
      ),
    ).toThrow("must be pending");
  });
});
