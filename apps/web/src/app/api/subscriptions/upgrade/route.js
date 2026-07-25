import sql from "@/app/api/utils/sql";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";

export async function POST(request) {
  try {
    const disabled = requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS");
    if (disabled) return disabled;

    const userId = request.headers.get("x-user-id");
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { type, tier } = body; // type: 'vendor' | 'delivery', tier: 'premium'

    if (!type || !tier) {
      return Response.json({ error: "type and tier required" }, { status: 400 });
    }

    // Ensure user exists
    const uniqueId = userId.replace(/-/g, '');
    await sql`
      INSERT INTO users (id, name, email, phone)
      VALUES (${userId}::uuid, 'Utilisateur', ${uniqueId + '@omni.app'}, ${'+228' + uniqueId})
      ON CONFLICT (id) DO NOTHING
    `;

    if (type === 'vendor') {
      await sql`UPDATE users SET vendor_tier = 'premium' WHERE id = ${userId}`;
    } else if (type === 'delivery') {
      await sql`UPDATE users SET delivery_tier = 'premium' WHERE id = ${userId}`;
    } else {
      return Response.json({ error: "Invalid type" }, { status: 400 });
    }

    // Check wallet
    const wallet = await sql`SELECT id, balance FROM wallets WHERE user_id = ${userId}`;
    const fee = type === 'vendor' ? 5000 : 1000;

    if (wallet.length === 0 || wallet[0].balance < fee) {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }

    await sql`UPDATE wallets SET balance = balance - ${fee}, updated_at = CURRENT_TIMESTAMP WHERE id = ${wallet[0].id}`;
    await sql`
      INSERT INTO transactions (wallet_id, type, amount, reference)
      VALUES (${wallet[0].id}, 'withdrawal', ${fee}, ${`Abonnement ${type} ${tier}`})
    `;

    // Log subscription in subscriptions table
    await sql`
      INSERT INTO subscriptions (user_id, type, tier, start_date, end_date)
      VALUES (${userId}, ${type}, ${tier}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days')
    `;

    return Response.json({ success: true, fee });
  } catch (error) {
    console.error("Error upgrading:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
