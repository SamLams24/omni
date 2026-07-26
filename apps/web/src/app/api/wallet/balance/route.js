import sql from "@/app/api/utils/sql";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const disabled = requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS");
    if (disabled) return disabled;

    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    const wallets = await sql`
      SELECT w.balance, w.updated_at,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'type', t.type, 'amount', t.amount, 'reference', t.reference, 'created_at', t.created_at) ORDER BY t.created_at DESC), '[]'::jsonb)
         FROM transactions t WHERE t.wallet_id = w.id) as recent_transactions
      FROM wallets w WHERE w.user_id = ${userId}
    `;

    if (wallets.length === 0) {
      await sql`
        INSERT INTO wallets (user_id, balance)
        VALUES (${userId}, 0)
        ON CONFLICT (user_id) DO NOTHING
      `;
      return Response.json({ balance: 0, recent_transactions: [] });
    }

    return Response.json(wallets[0]);
  } catch (error) {
    console.error("Error fetching balance:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
