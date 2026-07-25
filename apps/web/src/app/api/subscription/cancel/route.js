import sql from "@/app/api/utils/sql";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";

export async function POST(request) {
  try {
    const disabled = requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS");
    if (disabled) return disabled;

    const userId = request.headers.get("x-user-id");
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { subscriberId, subscriberType } = body; // subscriberType: 'vendor' or 'delivery'

    if (!subscriberId || !subscriberType) {
      return Response.json({ error: "subscriberId and subscriberType required" }, { status: 400 });
    }

    const result = await sql`
      UPDATE subscriptions
      SET status = 'cancelled', auto_renew = false, updated_at = CURRENT_TIMESTAMP
      WHERE subscriber_id = ${subscriberId}
        AND subscriber_type = ${subscriberType}
        AND status IN ('free', 'active')
      RETURNING id, status
    `;

    if (result.length === 0) {
      return Response.json({ error: "No active subscription found" }, { status: 404 });
    }

    return Response.json({ success: true, subscription: result[0] });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
