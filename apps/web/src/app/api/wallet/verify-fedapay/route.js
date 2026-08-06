import { getAuthenticatedUser } from "@/lib/auth";
import { FedaPayApiError } from "@/lib/fedapay";
import { settleFedaPayDeposit } from "@/lib/wallet-deposits";

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

    const result = await settleFedaPayDeposit({ transactionId, userId });
    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.error, code: result.code },
        { status: result.status },
      );
    }

    return Response.json({
      ok: true,
      ...(result.alreadyProcessed
        ? { message: "Transaction already processed" }
        : {}),
      balance: result.balance,
      transactionId: result.transactionId,
      amount: result.amount,
      currency: result.currency,
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
