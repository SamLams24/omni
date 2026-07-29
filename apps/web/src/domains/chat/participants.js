import { ChatInputError } from "@/domains/chat/input";

export function isRequestParticipant(participants, userId) {
  return Boolean(
    participants
    && (
      participants.buyer_id === userId
      || participants.vendor_user_id === userId
    ),
  );
}

export function getRequestReceiver(participants, userId) {
  if (!isRequestParticipant(participants, userId)) {
    throw new ChatInputError("Conversation not found", 404);
  }
  return userId === participants.buyer_id
    ? participants.vendor_user_id
    : participants.buyer_id;
}

export function resolveVendorPeer(vendorOwnerId, userId, requestedPeerId) {
  if (vendorOwnerId === userId) {
    if (!requestedPeerId || requestedPeerId === userId) {
      throw new ChatInputError(
        "A peerId is required to reply to a buyer",
      );
    }
    return requestedPeerId;
  }

  if (requestedPeerId && requestedPeerId !== vendorOwnerId) {
    throw new ChatInputError("Conversation not found", 404);
  }
  return vendorOwnerId;
}

export function getConversationPeerId(message, userId) {
  if (message.sender_id === userId) return message.receiver_id;
  if (message.receiver_id === userId) return message.sender_id;
  throw new ChatInputError("User is not part of this conversation", 403);
}
