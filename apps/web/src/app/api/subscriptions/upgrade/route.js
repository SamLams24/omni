import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    const body = await request.json();
    const { type, tier } = body; // type: 'vendor' | 'delivery', tier: 'premium'

    if (!["vendor", "delivery"].includes(type) || tier !== "premium") {
      return Response.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const fee = type === "vendor" ? 5000 : 1000;
    const account = await sql`
      SELECT u.vendor_tier, u.delivery_tier, COALESCE(w.balance, 0) AS balance
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      WHERE u.id = ${userId}
    `;
    if (account.length === 0 || Number(account[0].balance) < fee) {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }
    if (account[0][`${type}_tier`] === "premium") {
      return Response.json({ error: "Subscription already active" }, { status: 409 });
    }

    const upgraded = type === "vendor"
      ? await sql`
          WITH debited AS (
            UPDATE wallets
            SET balance = balance - ${fee}, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ${userId}
              AND balance >= ${fee}
              AND EXISTS (
                SELECT 1 FROM users
                WHERE id = ${userId} AND vendor_tier <> 'premium'
              )
            RETURNING id
          ),
          subscribed AS (
            INSERT INTO subscriptions (user_id, type, tier, start_date, end_date)
            SELECT ${userId}, 'vendor', 'premium', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days'
            FROM debited
            RETURNING id
          ),
          activated AS (
            UPDATE users
            SET vendor_tier = 'premium', updated_at = CURRENT_TIMESTAMP
            WHERE id = ${userId} AND EXISTS (SELECT 1 FROM subscribed)
            RETURNING id
          )
          INSERT INTO transactions (wallet_id, type, amount, reference)
          SELECT id, 'withdrawal', ${fee}, 'Abonnement vendor premium'
          FROM debited
          WHERE EXISTS (SELECT 1 FROM activated)
          RETURNING id
        `
      : await sql`
          WITH debited AS (
            UPDATE wallets
            SET balance = balance - ${fee}, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ${userId}
              AND balance >= ${fee}
              AND EXISTS (
                SELECT 1 FROM users
                WHERE id = ${userId} AND delivery_tier <> 'premium'
              )
            RETURNING id
          ),
          subscribed AS (
            INSERT INTO subscriptions (user_id, type, tier, start_date, end_date)
            SELECT ${userId}, 'delivery', 'premium', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days'
            FROM debited
            RETURNING id
          ),
          activated AS (
            UPDATE users
            SET delivery_tier = 'premium', updated_at = CURRENT_TIMESTAMP
            WHERE id = ${userId} AND EXISTS (SELECT 1 FROM subscribed)
            RETURNING id
          )
          INSERT INTO transactions (wallet_id, type, amount, reference)
          SELECT id, 'withdrawal', ${fee}, 'Abonnement delivery premium'
          FROM debited
          WHERE EXISTS (SELECT 1 FROM activated)
          RETURNING id
        `;

    if (upgraded.length === 0) {
      return Response.json(
        { error: "Subscription could not be activated" },
        { status: 409 },
      );
    }

    return Response.json({ success: true, fee });
  } catch (error) {
    console.error("Error upgrading:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
