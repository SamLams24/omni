import sql from "@/app/api/utils/sql";
import { FedaPayApiError } from "@/lib/fedapay";
import {
  constructFedaPayWebhookEvent,
  FedaPayWebhookError,
  getFedaPayEventId,
  getFedaPayEventName,
  getFedaPayEventTransactionId,
} from "@/lib/fedapay-webhook";
import { settleFedaPayDeposit } from "@/lib/wallet-deposits";

const MAX_WEBHOOK_BYTES = 256 * 1024;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function updateEventStatus(id, status, errorCode = null) {
  await sql`
    UPDATE fedapay_webhook_events
    SET status = ${status},
        last_error_code = ${errorCode},
        processed_at = CASE
          WHEN ${status} IN ('processed', 'ignored') THEN CURRENT_TIMESTAMP
          ELSE processed_at
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `;
}

export async function POST(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json({ error: "Unsupported media type" }, 415);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) {
    return json({ error: "Payload too large" }, 413);
  }

  const webhookSecret = process.env.FEDAPAY_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error("[FedaPay] Webhook secret is not configured");
    return json({ error: "Webhook unavailable" }, 503);
  }

  let rawBody;
  let event;
  try {
    rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) {
      return json({ error: "Payload too large" }, 413);
    }
    event = constructFedaPayWebhookEvent(
      rawBody,
      request.headers.get("x-fedapay-signature"),
      webhookSecret,
    );
  } catch (error) {
    if (!(error instanceof FedaPayWebhookError)) {
      console.error("[FedaPay] Webhook body could not be read");
    }
    return json({ error: "Invalid webhook" }, 400);
  }

  const eventName = getFedaPayEventName(event);
  if (eventName !== "transaction.approved") {
    return json({ received: true, ignored: true });
  }

  const eventId = getFedaPayEventId(event);
  const transactionId = getFedaPayEventTransactionId(event);
  if (!eventId || !transactionId) {
    return json({ error: "Invalid transaction event" }, 400);
  }

  let webhookEvent;
  try {
    const rows = await sql`
      INSERT INTO fedapay_webhook_events (
        provider_event_id, event_name, provider_transaction_id
      )
      VALUES (${eventId}, ${eventName}, ${transactionId})
      ON CONFLICT (provider_event_id) DO UPDATE
        SET attempts = fedapay_webhook_events.attempts + 1,
            last_received_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE fedapay_webhook_events.event_name = EXCLUDED.event_name
          AND fedapay_webhook_events.provider_transaction_id = EXCLUDED.provider_transaction_id
      RETURNING id, status
    `;
    webhookEvent = rows[0];
  } catch {
    console.error("[FedaPay] Webhook event could not be persisted");
    return json({ error: "Webhook unavailable" }, 503);
  }

  if (!webhookEvent) {
    return json({ error: "Webhook event conflict" }, 400);
  }
  if (["processed", "ignored"].includes(webhookEvent.status)) {
    return json({ received: true, duplicate: true });
  }

  try {
    const result = await settleFedaPayDeposit({ transactionId });
    if (!result.ok) {
      if (result.code === "not_approved") {
        await updateEventStatus(webhookEvent.id, "failed", result.code);
        return json({ error: "Transaction not yet verifiable" }, 503);
      }

      await updateEventStatus(webhookEvent.id, "ignored", result.code);
      return json({ received: true, ignored: true });
    }

    await updateEventStatus(webhookEvent.id, "processed");
    return json({
      received: true,
      processed: !result.alreadyProcessed,
      duplicate: result.alreadyProcessed,
    });
  } catch (error) {
    try {
      await updateEventStatus(
        webhookEvent.id,
        "failed",
        error instanceof FedaPayApiError ? "provider_unavailable" : "internal_error",
      );
    } catch {
      console.error("[FedaPay] Webhook failure could not be recorded");
    }
    console.error("[FedaPay] Webhook processing failed");
    return json({ error: "Webhook processing unavailable" }, 503);
  }
}
