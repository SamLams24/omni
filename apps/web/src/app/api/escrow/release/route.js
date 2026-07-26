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
      JOIN carts c ON c.id = eh.cart_id
      JOIN vendors v ON v.id = eh.vendor_id
      JOIN wallets w ON w.user_id = v.user_id
      WHERE eh.cart_id = ${cartId}
        AND eh.status = 'held'
        AND c.buyer_id = ${userId}
    `;
    if (holds.length === 0) {
      return Response.json(
        { error: "No releasable escrow found or unauthorized" },
        { status: 404 },
      );
    }

    const released = await sql`
      WITH transitioned AS (
        UPDATE escrow_holds
        SET status = 'released', released_at = CURRENT_TIMESTAMP
        WHERE id = ${holds[0].id} AND status = 'held'
        RETURNING vendor_id, amount
      ),
      credited AS (
        UPDATE wallets w
        SET balance = w.balance + t.amount,
            updated_at = CURRENT_TIMESTAMP
        FROM transitioned t
        JOIN vendors v ON v.id = t.vendor_id
        WHERE w.user_id = v.user_id
        RETURNING w.id, t.amount
      )
        INSERT INTO transactions (wallet_id, type, amount, reference)
        SELECT id, 'escrow_release', amount, ${`Release for cart ${cartId}`}
        FROM credited
        RETURNING id
    `;
    if (released.length === 0) {
      return Response.json({ error: "Escrow already finalized" }, { status: 409 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error releasing escrow:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
