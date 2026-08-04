import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

// Simple in-memory rate limiter (10 requests per minute per user)
const rateLimits = new Map();

function checkRateLimit(key, limit = 10, windowMs = 60000) {
  const now = Date.now();
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
    if (typeof amount !== "number" || amount <= 0) {
      return Response.json(
        { error: "amount must be a positive number" },
        { status: 400 },
      );
    }

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

    // Duplicate prevention — check if this transaction was already processed
    const reference = `fedapay:${transactionId}`;
    const existing = await sql`
      SELECT id FROM transactions
      WHERE reference = ${reference}
      LIMIT 1
    `;
    if (existing.length > 0) {
      // Already processed — return current balance
      const wallets = await sql`
        SELECT balance FROM wallets WHERE user_id = ${userId}
      `;
      return Response.json({
        ok: true,
        message: "Transaction already processed",
        balance: wallets.length > 0 ? Number(wallets[0].balance) : 0,
      });
    }

    // Credit the wallet
    await sql`
      WITH credited AS (
        INSERT INTO wallets (user_id, balance)
        VALUES (${userId}, ${confirmedAmount})
        ON CONFLICT (user_id) DO UPDATE
          SET balance = wallets.balance + EXCLUDED.balance,
              updated_at = CURRENT_TIMESTAMP
        RETURNING id
      )
      INSERT INTO transactions (wallet_id, type, amount, reference)
      SELECT id, 'deposit', ${confirmedAmount}, ${reference}
      FROM credited
    `;

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
