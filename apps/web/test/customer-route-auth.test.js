import { existsSync, readFileSync } from "node:fs";
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
    const route = readSource("../src/app/api/chat/messages/route.js");
    const participants = readSource(
      "../src/domains/chat/participants.js",
    );

    expect(route).toContain("isRequestParticipant");
    expect(route).toContain("m.receiver_id");
    expect(participants).toContain("participants.buyer_id");
    expect(participants).toContain("participants.vendor_user_id");
  });

  it("separates vendor conversations by authenticated peer", () => {
    const messages = readSource("../src/app/api/chat/messages/route.js");
    const conversations = readSource(
      "../src/app/api/vendors/conversations/route.js",
    );

    expect(messages).toContain("resolveVendorPeer");
    expect(messages).toContain("sender.name AS sender_name");
    expect(messages).toContain("LIMIT 100");
    expect(messages).toContain("SET is_read = true");
    expect(conversations).toContain("peer_id");
    expect(conversations).toContain("PARTITION BY conversation_key");
    expect(conversations).toContain("unread_count");
  });

  it("removes the unused client-identified realtime channel", () => {
    expect(existsSync(new URL(
      "../src/app/api/realtime/route.js",
      import.meta.url,
    ))).toBe(false);
    expect(existsSync(new URL(
      "../src/hooks/useRealtime.js",
      import.meta.url,
    ))).toBe(false);
  });
});
