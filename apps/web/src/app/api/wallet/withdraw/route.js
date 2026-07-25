import sql from "@/app/api/utils/sql";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";

const ensureUser = async (userId) => {
  const uniqueId = userId.replace(/-/g, '');
  await sql`
    INSERT INTO users (id, name, email, phone)
    VALUES (${userId}::uuid, 'Utilisateur', ${uniqueId + '@omni.app'}, ${'+228' + uniqueId})
    ON CONFLICT (id) DO NOTHING
  `;
};

export async function POST(request) {
  try {
    const disabled = requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS");
    if (disabled) return disabled;

    const userId = request.headers.get("x-user-id");
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { amount, method } = body; // method: 'mobile_money' or 'crypto'

    if (!amount || amount <= 0) {
      return Response.json({ error: "Invalid amount" }, { status: 400 });
    }

    await ensureUser(userId);

    const wallet = await sql`
      SELECT id, balance FROM wallets WHERE user_id = ${userId}
    `;
    if (wallet.length === 0) {
      return Response.json({ error: "No wallet found" }, { status: 404 });
    }

    if (wallet[0].balance < amount) {
      return Response.json({ error: "Solde insuffisant" }, { status: 400 });
    }

    // Mock: always succeeds
    await sql`
      UPDATE wallets SET balance = balance - ${amount}, updated_at = CURRENT_TIMESTAMP WHERE id = ${wallet[0].id}
    `;

    await sql`
      INSERT INTO transactions (wallet_id, type, amount, reference)
      VALUES (${wallet[0].id}, 'withdrawal', ${amount}, ${`Withdrawal via ${method || 'mobile_money'}`})
    `;

    return Response.json({ success: true, withdrawn: amount });
  } catch (error) {
    console.error("Error withdrawing:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
