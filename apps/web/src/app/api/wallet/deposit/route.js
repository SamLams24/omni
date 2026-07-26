import sql from "@/app/api/utils/sql";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(request) {
  try {
    const disabled = requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS");
    if (disabled) return disabled;

    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    const body = await request.json();
    const { amount, method } = body; // method: 'mobile_money' or 'crypto'
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return Response.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (!["mobile_money", "crypto"].includes(method)) {
      return Response.json({ error: "Invalid method" }, { status: 400 });
    }

    // Development-only mock credit. The feature flag above always fails closed in production.
    await sql`
      WITH credited AS (
        INSERT INTO wallets (user_id, balance)
        VALUES (${userId}, ${numericAmount})
        ON CONFLICT (user_id) DO UPDATE
          SET balance = wallets.balance + EXCLUDED.balance,
              updated_at = CURRENT_TIMESTAMP
        RETURNING id
      )
      INSERT INTO transactions (wallet_id, type, amount, reference)
      SELECT id, 'deposit', ${numericAmount}, ${`Mock deposit via ${method}`}
      FROM credited
    `;

    return Response.json({ success: true, deposited: numericAmount });
  } catch (error) {
    console.error("Error depositing:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
