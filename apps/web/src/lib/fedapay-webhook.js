import { createHmac, timingSafeEqual } from "node:crypto";
import { isValidFedaPayTransactionId } from "@/lib/fedapay";

const SIGNATURE_SCHEME = "s";
export const FEDAPAY_WEBHOOK_TOLERANCE_SECONDS = 300;

export class FedaPayWebhookError extends Error {
  constructor(message) {
    super(message);
    this.name = "FedaPayWebhookError";
  }
}

function parseSignatureHeader(header) {
  if (typeof header !== "string" || !header) {
    throw new FedaPayWebhookError("Missing webhook signature");
  }

  const timestamps = [];
  const signatures = [];
  for (const item of header.split(",")) {
    const separator = item.indexOf("=");
    if (separator === -1) continue;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (key === "t" && /^\d{1,12}$/.test(value)) {
      timestamps.push(Number(value));
    }
    if (key === SIGNATURE_SCHEME && /^[a-f0-9]{64}$/i.test(value)) {
      signatures.push(value.toLowerCase());
    }
  }

  if (timestamps.length !== 1 || signatures.length === 0) {
    throw new FedaPayWebhookError("Invalid webhook signature format");
  }
  return { timestamp: timestamps[0], signatures };
}

function constantTimeHexEqual(left, right) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer);
}

export function constructFedaPayWebhookEvent(
  rawBody,
  signatureHeader,
  secret,
  {
    nowSeconds = Math.floor(Date.now() / 1000),
    toleranceSeconds = FEDAPAY_WEBHOOK_TOLERANCE_SECONDS,
  } = {},
) {
  if (typeof rawBody !== "string" || typeof secret !== "string" || !secret) {
    throw new FedaPayWebhookError("Invalid webhook verification input");
  }

  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    throw new FedaPayWebhookError("Webhook timestamp outside tolerance");
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  if (!signatures.some((signature) => constantTimeHexEqual(signature, expected))) {
    throw new FedaPayWebhookError("Webhook signature mismatch");
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new FedaPayWebhookError("Invalid webhook JSON");
  }
}

export function getFedaPayEventName(event) {
  const name = event?.name ?? event?.type;
  return typeof name === "string" ? name : null;
}

export function getFedaPayEventId(event) {
  const value = event?.id;
  const id = typeof value === "number" || typeof value === "string"
    ? String(value)
    : "";
  return /^[A-Za-z0-9._:-]{1,255}$/.test(id) ? id : null;
}

export function getFedaPayEventTransactionId(event) {
  const value = event?.object_id ?? event?.entity?.id;
  const id = typeof value === "number" || typeof value === "string"
    ? String(value)
    : "";
  return isValidFedaPayTransactionId(id) ? id : null;
}
