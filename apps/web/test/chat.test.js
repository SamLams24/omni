import { describe, expect, it } from "vitest";
import {
  parseConversationReference,
  parseMessageInput,
} from "@/domains/chat/input";
import {
  getConversationPeerId,
  getRequestReceiver,
  isRequestParticipant,
  resolveVendorPeer,
} from "@/domains/chat/participants";

const participants = {
  buyer_id: "buyer-1",
  vendor_user_id: "vendor-user-1",
};

describe("chat input", () => {
  it("accepts one request conversation reference", () => {
    expect(parseConversationReference(
      new URLSearchParams({ requestId: "request-1" }),
    )).toEqual({
      requestId: "request-1",
      vendorId: null,
      peerId: null,
    });
  });

  it("accepts a vendor conversation with an explicit peer", () => {
    expect(parseConversationReference({
      vendorId: "vendor-1",
      peerId: "buyer-1",
    })).toEqual({
      requestId: null,
      vendorId: "vendor-1",
      peerId: "buyer-1",
    });
  });

  it("requires exactly one conversation type", () => {
    expect(() => parseConversationReference({}))
      .toThrow("Missing requestId or vendorId");
    expect(() =>
      parseConversationReference({
        requestId: "request-1",
        vendorId: "vendor-1",
      }),
    ).toThrow("Choose either requestId or vendorId");
  });

  it("rejects a peer on request conversations", () => {
    expect(() =>
      parseConversationReference({
        requestId: "request-1",
        peerId: "buyer-1",
      }),
    ).toThrow("peerId is only valid");
  });

  it("trims valid message content", () => {
    expect(parseMessageInput({
      vendorId: "vendor-1",
      content: "  Bonjour  ",
    }).content).toBe("Bonjour");
  });

  it("rejects empty and oversized messages", () => {
    expect(() =>
      parseMessageInput({ vendorId: "vendor-1", content: "   " }),
    ).toThrow("Missing required fields");
    expect(() =>
      parseMessageInput({
        vendorId: "vendor-1",
        content: "a".repeat(2001),
      }),
    ).toThrow("Message is too long");
  });
});

describe("chat participants", () => {
  it("recognizes both request participants", () => {
    expect(isRequestParticipant(participants, "buyer-1")).toBe(true);
    expect(isRequestParticipant(participants, "vendor-user-1")).toBe(true);
    expect(isRequestParticipant(participants, "outsider-1")).toBe(false);
  });

  it("selects the other request participant as receiver", () => {
    expect(getRequestReceiver(participants, "buyer-1"))
      .toBe("vendor-user-1");
    expect(getRequestReceiver(participants, "vendor-user-1"))
      .toBe("buyer-1");
    expect(() => getRequestReceiver(participants, "outsider-1"))
      .toThrow("Conversation not found");
  });

  it("uses the vendor owner as the buyer's peer", () => {
    expect(resolveVendorPeer(
      "vendor-user-1",
      "buyer-1",
      null,
    )).toBe("vendor-user-1");
  });

  it("prevents a buyer from selecting another peer", () => {
    expect(() =>
      resolveVendorPeer("vendor-user-1", "buyer-1", "outsider-1"),
    ).toThrow("Conversation not found");
  });

  it("requires an explicit buyer when the vendor replies", () => {
    expect(() =>
      resolveVendorPeer("vendor-user-1", "vendor-user-1", null),
    ).toThrow("peerId is required");
    expect(resolveVendorPeer(
      "vendor-user-1",
      "vendor-user-1",
      "buyer-1",
    )).toBe("buyer-1");
  });

  it("derives the peer from either message direction", () => {
    expect(getConversationPeerId({
      sender_id: "buyer-1",
      receiver_id: "vendor-user-1",
    }, "buyer-1")).toBe("vendor-user-1");
    expect(getConversationPeerId({
      sender_id: "buyer-1",
      receiver_id: "vendor-user-1",
    }, "vendor-user-1")).toBe("buyer-1");
  });

  it("rejects users outside a message", () => {
    expect(() =>
      getConversationPeerId({
        sender_id: "buyer-1",
        receiver_id: "vendor-user-1",
      }, "outsider-1"),
    ).toThrow("not part of this conversation");
  });
});
