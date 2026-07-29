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

    // Development-only mock debit, kept atomic to prevent concurrent overdrafts.
    const debited = await sql`
      WITH debited AS (
        UPDATE wallets
        SET balance = balance - ${numericAmount},
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${userId}
          AND balance >= ${numericAmount}
        RETURNING id
      ),
      recorded AS (
        INSERT INTO transactions (wallet_id, type, amount, reference)
        SELECT id, 'withdrawal', ${numericAmount}, ${`Mock withdrawal via ${method}`}
        FROM debited
        RETURNING id
      )
      SELECT id FROM debited
    `;
    if (debited.length === 0) {
      return Response.json({ error: "Solde insuffisant" }, { status: 400 });
    }

    return Response.json({ success: true, withdrawn: numericAmount });
  } catch (error) {
    console.error("Error withdrawing:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
