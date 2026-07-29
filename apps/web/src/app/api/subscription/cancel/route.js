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
    const { type } = body;

    if (!["vendor", "delivery"].includes(type)) {
      return Response.json({ error: "Invalid subscription type" }, { status: 400 });
    }

    const result = type === "vendor"
      ? await sql`
          WITH cancelled AS (
            UPDATE subscriptions
            SET end_date = CURRENT_TIMESTAMP
            WHERE user_id = ${userId}
              AND type = 'vendor'
              AND tier = 'premium'
              AND (end_date IS NULL OR end_date > CURRENT_TIMESTAMP)
            RETURNING id
          ),
          downgraded AS (
            UPDATE users
            SET vendor_tier = 'free', updated_at = CURRENT_TIMESTAMP
            WHERE id = ${userId} AND EXISTS (SELECT 1 FROM cancelled)
            RETURNING id
          )
          SELECT id FROM cancelled WHERE EXISTS (SELECT 1 FROM downgraded)
        `
      : await sql`
          WITH cancelled AS (
            UPDATE subscriptions
            SET end_date = CURRENT_TIMESTAMP
            WHERE user_id = ${userId}
              AND type = 'delivery'
              AND tier = 'premium'
              AND (end_date IS NULL OR end_date > CURRENT_TIMESTAMP)
            RETURNING id
          ),
          downgraded AS (
            UPDATE users
            SET delivery_tier = 'free', updated_at = CURRENT_TIMESTAMP
            WHERE id = ${userId} AND EXISTS (SELECT 1 FROM cancelled)
            RETURNING id
          )
          SELECT id FROM cancelled WHERE EXISTS (SELECT 1 FROM downgraded)
        `;

    if (result.length === 0) {
      return Response.json({ error: "No active subscription found" }, { status: 404 });
    }

    return Response.json({ success: true, subscriptionId: result[0].id });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
