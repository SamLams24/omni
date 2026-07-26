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
    const { cartId } = body;

    if (!cartId) return Response.json({ error: "cartId required" }, { status: 400 });

    const holds = await sql`
      SELECT eh.id
      FROM escrow_holds eh
      JOIN vendors v ON v.id = eh.vendor_id
      JOIN wallets w ON w.user_id = eh.buyer_id
      WHERE eh.cart_id = ${cartId}
        AND eh.status IN ('held', 'disputed')
        AND v.user_id = ${userId}
    `;
    if (holds.length === 0) {
      return Response.json(
        { error: "No refundable escrow found or unauthorized" },
        { status: 404 },
      );
    }

    const refunded = await sql`
      WITH transitioned AS (
        UPDATE escrow_holds
        SET status = 'refunded', released_at = CURRENT_TIMESTAMP
        WHERE id = ${holds[0].id}
          AND status IN ('held', 'disputed')
        RETURNING buyer_id, amount + fee AS refund_amount
      ),
      credited AS (
        UPDATE wallets w
        SET balance = w.balance + t.refund_amount,
            updated_at = CURRENT_TIMESTAMP
        FROM transitioned t
        WHERE w.user_id = t.buyer_id
        RETURNING w.id, t.refund_amount
      )
        INSERT INTO transactions (wallet_id, type, amount, reference)
        SELECT id, 'escrow_refund', refund_amount, ${`Refund for cart ${cartId}`}
        FROM credited
        RETURNING id
    `;
    if (refunded.length === 0) {
      return Response.json({ error: "Escrow already finalized" }, { status: 409 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error refunding escrow:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
