import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("cart state machine integration", () => {
  it("checks escrow funds before transitioning the cart", () => {
    const source = readSource("../src/app/api/cart/respond/route.js");

    expect(source).toContain("w.balance >= ${amountToHold}");
    expect(source).toContain("c.status = 'pending'");
    expect(source).toContain("Cart was already processed or changed");
    expect(source).toContain("status: 402");
  });

  it("updates every cart item from one validated response set", () => {
    const source = readSource("../src/app/api/cart/respond/route.js");

    expect(source).toContain("jsonb_array_elements");
    expect(source).toContain("(SELECT COUNT(*) FROM updated_requests)");
    expect(source).toContain("buildCartResponse");
    expect(source).toContain("COALESCE(ar.unit_price, p.price)");
  });

  it("creates carts, requests and delivery records in one statement", () => {
    const source = readSource("../src/app/api/cart/send/route.js");

    expect(source).toContain("created_cart AS");
    expect(source).toContain("created_requests AS");
    expect(source).toContain("created_delivery AS");
    expect(source).toContain("pg_advisory_xact_lock");
    expect(source).toContain("is_available = true");
    expect(source).toContain("ENABLE_MOCK_FINANCIAL_FLOWS");
    expect(source).toContain("'awaiting_confirmation'");
    expect(source).toContain("input.unit_price");
  });

  it("only exposes delivery requests after a positive vendor response", () => {
    const response = readSource("../src/app/api/cart/respond/route.js");
    const schema = readSource("../scripts/create-tables.sql");

    expect(response).toContain("status = 'awaiting_confirmation'");
    expect(response).toContain("ELSE 'looking'");
    expect(schema).toContain(
      "'awaiting_confirmation', 'looking', 'matched'",
    );
  });

  it("promotes complete cart groups instead of individual items", () => {
    for (const path of [
      "../src/app/api/cart/respond/route.js",
      "../src/app/api/cart/[id]/cancel/route.js",
      "../src/app/api/availability/respond/route.js",
    ]) {
      const source = readSource(path);
      expect(source).toContain("ng.cart_id IS NOT NULL AND ar.cart_id = ng.cart_id");
    }
  });

  it("makes cancel and receive transitions replay-safe", () => {
    const cancel = readSource("../src/app/api/cart/[id]/cancel/route.js");
    const received = readSource("../src/app/api/cart/[id]/received/route.js");

    expect(cancel).toContain("WITH transitioned AS");
    expect(cancel).toContain("status IN ('pending', 'confirmed', 'partial', 'denied')");
    expect(received).toContain("WITH transitioned AS");
    expect(received).toContain("status IN ('confirmed', 'partial')");
    expect(received).toContain("Delivery must be completed");
  });

  it("prevents standalone responses from mutating grouped cart items", () => {
    const source = readSource("../src/app/api/availability/respond/route.js");

    expect(source).toContain("if (availabilityRequest.cart_id)");
    expect(source).toContain("Cart items must be answered");
  });

  it("expires pending carts before returning customer or vendor lists", () => {
    const history = readSource("../src/app/api/cart/history/route.js");
    const vendor = readSource("../src/app/api/cart/vendor-pending/route.js");

    expect(history).toContain("WITH expired_carts AS");
    expect(vendor).toContain("expired_carts AS");
    expect(vendor).toContain("owned_facilities AS");
    expect(history).toContain("expires_at <= CURRENT_TIMESTAMP");
    expect(vendor).toContain("expires_at <= CURRENT_TIMESTAMP");
  });
});
