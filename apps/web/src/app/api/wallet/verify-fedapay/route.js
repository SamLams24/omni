import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

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

    const body = await request.json();
    const { transactionId, amount } = body;

    // Validate input
    if (!transactionId || typeof transactionId !== "string") {
      return Response.json(
        { error: "transactionId is required" },
        { status: 400 },
      );
    }
    // amount is optional — we use the API-confirmed amount for crediting

    // Verify with FedaPay API
    const apiKey = process.env.FEDAPAY_SECRET_KEY;
    if (!apiKey) {
      console.error("[FedaPay] Secret key not configured");
      return Response.json(
        { error: "Payment provider not configured" },
        { status: 500 },
      );
    }

    const response = await fetch(
      `https://app.fedapay.com/api/v1/transactions/${transactionId}.json`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[FedaPay] Verification failed:", errText);
      return Response.json(
        { error: "Payment verification failed" },
        { status: 400 },
      );
    }

    const tx = await response.json();

    // Accept "approved", "completed", or "paid" as valid statuses (FedaPay uses
    // different labels across API versions). Also accept "approved" for test mode.
    const validStatuses = ["approved", "completed", "paid"];
    if (!tx.status || !validStatuses.includes(tx.status.toLowerCase())) {
      return Response.json({
        ok: false,
        error: `Transaction status "${tx.status}" is not accepted`,
      });
    }

    // Record the credit — use the API-confirmed amount, NOT client-supplied amount
    const confirmedAmount = Number(tx.amount);
    if (!confirmedAmount || confirmedAmount <= 0) {
      return Response.json({ ok: false, error: "Transaction amount is invalid" });
    }

    // Atomic duplicate check + credit using CTE
    const reference = `fedapay:${transactionId}`;
    const credited = await sql`
      WITH existing_tx AS (
        SELECT id FROM transactions
        WHERE reference = ${reference}
        LIMIT 1
      ),
      credited AS (
        INSERT INTO wallets (user_id, balance)
        VALUES (${userId}, ${confirmedAmount})
        ON CONFLICT (user_id) DO UPDATE
          SET balance = wallets.balance + EXCLUDED.balance,
              updated_at = CURRENT_TIMESTAMP
        WHERE NOT EXISTS (SELECT 1 FROM existing_tx)
        RETURNING id, balance
      )
      INSERT INTO transactions (wallet_id, type, amount, reference)
      SELECT id, 'deposit', ${confirmedAmount}, ${reference}
      FROM credited
      WHERE NOT EXISTS (SELECT 1 FROM existing_tx)
      RETURNING id
    `;

    if (credited.length === 0) {
      // Either duplicate or wallet not found — check which
      const existing = await sql`SELECT id FROM transactions WHERE reference = ${reference} LIMIT 1`;
      if (existing.length > 0) {
        const wallets = await sql`SELECT balance FROM wallets WHERE user_id = ${userId}`;
        return Response.json({
          ok: true,
          message: "Transaction already processed",
          balance: wallets.length > 0 ? Number(wallets[0].balance) : 0,
        });
      }
      return Response.json({ ok: false, error: "Failed to credit wallet" });
    }

    // Return updated balance
    const wallets = await sql`
      SELECT balance FROM wallets WHERE user_id = ${userId}
    `;

    return Response.json({
      ok: true,
      balance: wallets.length > 0 ? Number(wallets[0].balance) : 0,
      transactionId,
    });
  } catch (error) {
    console.error("[FedaPay] Error verifying transaction:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
