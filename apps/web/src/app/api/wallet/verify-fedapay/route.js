import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  FedaPayApiError,
  isValidFedaPayTransactionId,
  requestFedaPay,
} from "@/lib/fedapay";

// Simple in-memory rate limiter (10 requests per minute per user)
const rateLimits = new Map();

function checkRateLimit(key, limit = 10, windowMs = 60000) {
  const now = Date.now();

  // Periodic cleanup: every 100 requests, prune expired entries
  if (rateLimits.size > 100 && Math.random() < 0.01) {
    for (const [k, v] of rateLimits) {
      if (now > v.resetAt) rateLimits.delete(k);
    }
  }

  const record = rateLimits.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  record.count++;
  rateLimits.set(key, record);

  return record.count <= limit;
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    // Rate limit: 10 requests per minute per user
    const rateLimitKey = `fedapay:${userId}`;
    if (!checkRateLimit(rateLimitKey)) {
      return Response.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { transactionId } = body;

    // Validate input
    if (!isValidFedaPayTransactionId(transactionId)) {
      return Response.json(
        { error: "A valid transactionId is required" },
        { status: 400 },
      );
    }
    const intents = await sql`
      SELECT id, amount, currency, status
      FROM wallet_deposit_intents
      WHERE user_id = ${userId}
        AND provider = 'fedapay'
        AND provider_transaction_id = ${transactionId}
      LIMIT 1
    `;
    const intent = intents[0];
    if (!intent) {
      return Response.json({ error: "Deposit intent not found" }, { status: 404 });
    }

    if (intent.status === "settled") {
      const wallets = await sql`SELECT balance FROM wallets WHERE user_id = ${userId}`;
      return Response.json({
        ok: true,
        message: "Transaction already processed",
        balance: wallets.length > 0 ? Number(wallets[0].balance) : 0,
        amount: Number(intent.amount),
        currency: intent.currency,
      });
    }
    if (intent.status !== "pending") {
      return Response.json(
        { error: "Deposit intent is not payable" },
        { status: 409 },
      );
    }

    const tx = await requestFedaPay(`/transactions/${transactionId}`);
    if (String(tx?.id || "") !== transactionId) {
      return Response.json({ error: "Transaction identity mismatch" }, { status: 400 });
    }
    if (tx.status !== "approved") {
      return Response.json(
        { ok: false, error: "Transaction is not approved" },
        { status: 409 },
      );
    }

    const confirmedAmount = Number(tx.amount);
    const expectedAmount = Number(intent.amount);
    if (!Number.isSafeInteger(confirmedAmount) || confirmedAmount !== expectedAmount) {
      return Response.json({ error: "Transaction amount mismatch" }, { status: 400 });
    }
    if (tx.custom_metadata?.omni_deposit_intent_id !== intent.id) {
      return Response.json({ error: "Transaction ownership mismatch" }, { status: 403 });
    }

    await sql`
      INSERT INTO wallets (user_id, balance)
      VALUES (${userId}, 0)
      ON CONFLICT (user_id) DO NOTHING
    `;

    const reference = `fedapay:${transactionId}`;
    const credited = await sql`
      WITH claimed_intent AS (
        UPDATE wallet_deposit_intents
        SET status = 'settled',
            settled_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${intent.id}
          AND user_id = ${userId}
          AND provider_transaction_id = ${transactionId}
          AND status = 'pending'
          AND amount = ${confirmedAmount}
        RETURNING amount
      ),
      recorded_tx AS (
        INSERT INTO transactions (wallet_id, type, amount, reference)
        SELECT wallets.id, 'deposit', claimed_intent.amount, ${reference}
        FROM wallets, claimed_intent
        WHERE wallets.user_id = ${userId}
        ON CONFLICT (reference) WHERE reference IS NOT NULL DO NOTHING
        RETURNING wallet_id
      ),
      credited_wallet AS (
        UPDATE wallets
        SET balance = wallets.balance + claimed_intent.amount,
            updated_at = CURRENT_TIMESTAMP
        FROM claimed_intent, recorded_tx
        WHERE wallets.id = recorded_tx.wallet_id
        RETURNING wallets.balance
      )
      SELECT
        (SELECT balance FROM credited_wallet) AS balance,
        EXISTS (SELECT 1 FROM claimed_intent) AS claimed,
        EXISTS (SELECT 1 FROM recorded_tx) AS recorded
    `;

    if (!credited[0]?.recorded) {
      const wallets = await sql`SELECT balance FROM wallets WHERE user_id = ${userId}`;
      return Response.json({
        ok: true,
        message: "Transaction already processed",
        balance: wallets.length > 0 ? Number(wallets[0].balance) : 0,
        amount: confirmedAmount,
        currency: "XOF",
      });
    }

    return Response.json({
      ok: true,
      balance: Number(credited[0].balance),
      transactionId,
      amount: confirmedAmount,
      currency: "XOF",
    });
  } catch (error) {
    console.error("[FedaPay] Transaction verification failed");
    return Response.json(
      { error: error instanceof FedaPayApiError && error.status === 500
        ? "Payment provider not configured"
        : "Payment verification unavailable" },
      { status: error instanceof FedaPayApiError ? error.status : 500 },
    );
  }
}
