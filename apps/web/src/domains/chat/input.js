export class ChatInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ChatInputError";
    this.status = status;
  }
}

function readValue(source, key) {
  const value = typeof source?.get === "function"
    ? source.get(key)
    : source?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseConversationReference(source) {
  const requestId = readValue(source, "requestId");
  const vendorId = readValue(source, "vendorId");
  const peerId = readValue(source, "peerId");

  if (!requestId && !vendorId) {
    throw new ChatInputError("Missing requestId or vendorId");
  }
  if (requestId && vendorId) {
    throw new ChatInputError("Choose either requestId or vendorId");
  }
  if (requestId && peerId) {
    throw new ChatInputError("peerId is only valid for vendor conversations");
  }

  return { requestId, vendorId, peerId };
}

export function parseMessageInput(body) {
  const reference = parseConversationReference(body);
  const content = typeof body?.content === "string"
    ? body.content.trim()
    : "";
  if (!content) {
    throw new ChatInputError("Missing required fields");
  }
  if (content.length > 2000) {
    throw new ChatInputError("Message is too long");
  }
  return { ...reference, content };
}
