import { describe, expect, it } from "vitest";
import {
  calculateDeliveryFee,
  normalizeConfirmedQuantity,
  parseAvailabilityRequestInput,
  parseAvailabilityResponseInput,
  parseCartCreationInput,
} from "@/domains/cart/input";

const validCart = {
  facilityId: "facility-1",
  items: [{ productId: "product-1", quantity: 2 }],
};

describe("cart creation input", () => {
  it("normalizes the default cash cart", () => {
    expect(parseCartCreationInput(validCart)).toEqual({
      facilityId: "facility-1",
      items: [{ product_id: "product-1", quantity_requested: 2 }],
      note: null,
      paymentMethod: "cash",
      wantsDelivery: false,
      dropoffAddress: null,
      dropoffLat: 0,
      dropoffLon: 0,
    });
  });

  it("normalizes valid delivery coordinates", () => {
    const result = parseCartCreationInput({
      ...validCart,
      delivery: true,
      dropoffLat: "6.125",
      dropoffLon: "1.225",
    });

    expect(result.wantsDelivery).toBe(true);
    expect(result.dropoffLat).toBe(6.125);
    expect(result.dropoffLon).toBe(1.225);
  });

  it.each([
    [[], "facilityId and items are required"],
    [
      Array.from({ length: 51 }, (_, index) => ({
        productId: `product-${index}`,
        quantity: 1,
      })),
      "facilityId and items are required",
    ],
    [
      [
        { productId: "product-1", quantity: 1 },
        { productId: "product-1", quantity: 2 },
      ],
      "unique products",
    ],
    [[{ productId: "product-1", quantity: 0 }], "valid quantities"],
    [[{ productId: "product-1", quantity: 1000 }], "valid quantities"],
  ])("rejects invalid item sets", (items, message) => {
    expect(() => parseCartCreationInput({ ...validCart, items }))
      .toThrow(message);
  });

  it.each(["card", "escrow"])("rejects unsupported payment method %s", (paymentMethod) => {
    expect(() =>
      parseCartCreationInput({ ...validCart, paymentMethod }),
    ).toThrow("Invalid payment method");
  });

  it.each([
    [null, 1],
    ["", 1],
    [91, 1],
    [-91, 1],
    [6, 181],
    [6, -181],
  ])("rejects invalid delivery coordinates", (lat, lon) => {
    expect(() =>
      parseCartCreationInput({
        ...validCart,
        delivery: true,
        dropoffLat: lat,
        dropoffLon: lon,
      }),
    ).toThrow("dropoffLat and dropoffLon");
  });
});

describe("delivery fee", () => {
  it("applies the minimum fee to a short trip", () => {
    expect(calculateDeliveryFee(6.125, 1.225, 6.126, 1.226)).toBe(500);
  });

  it("scales longer trips at 100 CFA per kilometre", () => {
    expect(calculateDeliveryFee(6.125, 1.225, 6.225, 1.225)).toBeGreaterThan(
      1000,
    );
  });

  it("rejects a facility without usable coordinates", () => {
    expect(() => calculateDeliveryFee(Number.NaN, 1.225, 6.2, 1.3))
      .toThrow("Facility location is unavailable");
  });
});

describe("standalone availability input", () => {
  it("normalizes a valid request quantity", () => {
    expect(parseAvailabilityRequestInput({
      vendorId: "vendor-1",
      facilityId: "facility-1",
      productId: "product-1",
      quantity: "3",
    })).toMatchObject({ quantity: 3 });
  });

  it.each([0, -1, 1.5, 1000, "not-a-number"])(
    "rejects invalid request quantity %s",
    (quantity) => {
      expect(() =>
        parseAvailabilityRequestInput({
          vendorId: "vendor-1",
          productId: "product-1",
          quantity,
        }),
      ).toThrow("valid quantity");
    },
  );

  it("requires a known response status", () => {
    expect(() =>
      parseAvailabilityResponseInput({
        requestId: "request-1",
        status: "partial",
      }),
    ).toThrow("valid requestId and status");
  });

  it("sets denied quantities to null", () => {
    expect(normalizeConfirmedQuantity("denied", 9, 3)).toBeNull();
  });

  it("normalizes a confirmed quantity within the requested amount", () => {
    expect(normalizeConfirmedQuantity("confirmed", "2", 3)).toBe(2);
  });

  it.each([0, 4, 1.5, "invalid"])(
    "rejects invalid confirmed quantity %s",
    (quantity) => {
      expect(() =>
        normalizeConfirmedQuantity("confirmed", quantity, 3),
      ).toThrow("Confirmed quantity is invalid");
    },
  );
});
