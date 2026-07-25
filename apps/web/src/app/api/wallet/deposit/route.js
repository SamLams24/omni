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

    // Mock: always succeeds
    const wallet = await sql`
      INSERT INTO wallets (user_id, balance) VALUES (${userId}, 0)
      ON CONFLICT (user_id) DO NOTHING
      RETURNING id
    `;

    let walletId;
    if (wallet.length > 0) {
      walletId = wallet[0].id;
    } else {
      const w = await sql`SELECT id FROM wallets WHERE user_id = ${userId}`;
      walletId = w[0].id;
    }

    await sql`UPDATE wallets SET balance = balance + ${amount}, updated_at = CURRENT_TIMESTAMP WHERE id = ${walletId}`;

    await sql`
      INSERT INTO transactions (wallet_id, type, amount, reference)
      VALUES (${walletId}, 'deposit', ${amount}, ${`Deposit via ${method || 'mobile_money'}`})
    `;

    return Response.json({ success: true, deposited: amount });
  } catch (error) {
    console.error("Error depositing:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
