import sql from "@/app/api/utils/sql";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";
import { getAuthenticatedUser } from "@/lib/auth";
import { promoteNextAvailabilityGroup } from "@/domains/cart/queue";

export async function POST(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return Response.json({ error: "Cart ID required" }, { status: 400 });
    }

    const carts = await sql`
      SELECT c.id, c.status, c.buyer_id, f.vendor_id
      FROM carts c
      JOIN facilities f ON f.id = c.facility_id
      WHERE c.id = ${id}
    `;
    if (carts.length === 0) {
      return Response.json({ error: "Cart not found" }, { status: 404 });
    }
    const cart = carts[0];
    if (cart.buyer_id !== user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (["completed", "cancelled"].includes(cart.status)) {
      return Response.json({ error: "Cart already finalized" }, { status: 409 });
    }

    const deliveries = await sql`
      SELECT status FROM delivery_requests WHERE cart_id = ${id}
    `;
    if (
      deliveries.length > 0
      && !["awaiting_confirmation", "looking", "cancelled"].includes(
        deliveries[0].status,
      )
    ) {
      return Response.json(
        { error: "An active delivery can no longer be cancelled from the cart" },
        { status: 409 },
      );
    }

    const holds = await sql`
      SELECT eh.id, w.id AS wallet_id
      FROM escrow_holds eh
      LEFT JOIN wallets w ON w.user_id = eh.buyer_id
      WHERE eh.cart_id = ${id} AND eh.status = 'held'
    `;
    const hasEscrowHold = holds.length > 0;
    if (hasEscrowHold && !holds[0].wallet_id) {
      return Response.json(
        { error: "Buyer wallet is unavailable for refund" },
        { status: 409 },
      );
    }
    if (hasEscrowHold) {
      const disabled = requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS");
      if (disabled) return disabled;
    }

    const cancelled = await sql`
      WITH transitioned AS (
        UPDATE carts
        SET status = 'cancelled'
        WHERE id = ${id}
          AND buyer_id = ${user.id}
          AND status IN ('pending', 'confirmed', 'partial', 'denied')
        RETURNING id
      ),
      refunded AS (
        UPDATE escrow_holds eh
        SET status = 'refunded', released_at = CURRENT_TIMESTAMP
        WHERE eh.cart_id = ${id}
          AND eh.status = 'held'
          AND EXISTS (SELECT 1 FROM transitioned)
        RETURNING eh.buyer_id, eh.amount + eh.fee AS refund_amount
      ),
      credited AS (
        UPDATE wallets w
        SET balance = w.balance + refunded.refund_amount,
            updated_at = CURRENT_TIMESTAMP
        FROM refunded
        WHERE w.user_id = refunded.buyer_id
        RETURNING w.id, refunded.refund_amount
      ),
      recorded AS (
        INSERT INTO transactions (wallet_id, type, amount, reference)
        SELECT id, 'escrow_refund', refund_amount, ${`Refund for cancelled cart ${id}`}
        FROM credited
        RETURNING id
      ),
      denied_requests AS (
        UPDATE availability_requests
        SET status = 'denied', quantity_confirmed = NULL,
            responded_at = CURRENT_TIMESTAMP
        WHERE cart_id = ${id}
          AND status IN ('pending', 'queued')
          AND EXISTS (SELECT 1 FROM transitioned)
        RETURNING id
      ),
      cancelled_delivery AS (
        UPDATE delivery_requests
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE cart_id = ${id}
          AND status IN ('awaiting_confirmation', 'looking')
          AND EXISTS (SELECT 1 FROM transitioned)
        RETURNING id
      )
      SELECT
        transitioned.id,
        CASE
          WHEN ${hasEscrowHold}
            THEN EXISTS (SELECT 1 FROM recorded)
          ELSE true
        END AS financial_complete
      FROM transitioned
    `;
    if (cancelled.length === 0) {
      return Response.json({ error: "Cart already finalized" }, { status: 409 });
    }
    if (!cancelled[0].financial_complete) {
      return Response.json(
        { error: "Escrow refund could not be completed" },
        { status: 409 },
      );
    }

    await promoteNextAvailabilityGroup(cart.vendor_id);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error cancelling cart:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
