import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const protectedRouteFiles = [
  "../src/app/api/availability/request/route.js",
  "../src/app/api/availability/respond/route.js",
  "../src/app/api/cart/[id]/cancel/route.js",
  "../src/app/api/cart/[id]/received/route.js",
  "../src/app/api/cart/history/route.js",
  "../src/app/api/cart/respond/route.js",
  "../src/app/api/cart/send/route.js",
  "../src/app/api/cart/vendor-pending/route.js",
  "../src/app/api/chat/messages/route.js",
  "../src/app/api/favorites/route.js",
  "../src/app/api/notifications/route.js",
  "../src/app/api/reviews/route.js",
];

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("customer route authentication", () => {
  it.each(protectedRouteFiles)(
    "%s relies on the server-validated session",
    (relativePath) => {
      const source = readSource(relativePath);

      expect(source).toContain("getAuthenticatedUser");
      expect(source).not.toContain("x-user-id");
    },
  );

  it("restricts request conversations to their buyer and vendor", () => {
    const source = readSource("../src/app/api/chat/messages/route.js");

    expect(source).toContain("isRequestParticipant");
    expect(source).toContain("participants.buyer_id");
    expect(source).toContain("participants.vendor_user_id");
    expect(source).toContain("m.receiver_id");
  });
});
