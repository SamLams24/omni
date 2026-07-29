import sql from "@/app/api/utils/sql";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";
import { getAuthenticatedUser } from "@/lib/auth";

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
      SELECT c.id, c.status, c.buyer_id, v.user_id AS vendor_user_id
      FROM carts c
      JOIN facilities f ON f.id = c.facility_id
      JOIN vendors v ON v.id = f.vendor_id
      WHERE c.id = ${id}
    `;
    if (carts.length === 0) {
      return Response.json({ error: "Cart not found" }, { status: 404 });
    }
    const cart = carts[0];
    if (cart.buyer_id !== user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!["confirmed", "partial"].includes(cart.status)) {
      return Response.json(
        { error: "Cart cannot be marked as received" },
        { status: 409 },
      );
    }

    const deliveries = await sql`
      SELECT status FROM delivery_requests WHERE cart_id = ${id}
    `;
    if (deliveries.length > 0 && deliveries[0].status !== "delivered") {
      return Response.json(
        { error: "Delivery must be completed before confirming receipt" },
        { status: 409 },
      );
    }

    const holds = await sql`
      SELECT eh.id, w.id AS wallet_id
      FROM escrow_holds eh
      JOIN vendors v ON v.id = eh.vendor_id
      LEFT JOIN wallets w ON w.user_id = v.user_id
      WHERE eh.cart_id = ${id} AND eh.status = 'held'
    `;
    const hasEscrowHold = holds.length > 0;
    if (hasEscrowHold && !holds[0].wallet_id) {
      return Response.json(
        { error: "Vendor wallet is unavailable for release" },
        { status: 409 },
      );
    }
    if (hasEscrowHold) {
      const disabled = requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS");
      if (disabled) return disabled;
    }

    const completed = await sql`
      WITH transitioned AS (
        UPDATE carts
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
          AND buyer_id = ${user.id}
          AND status IN ('confirmed', 'partial')
        RETURNING id
      ),
      released AS (
        UPDATE escrow_holds eh
        SET status = 'released', released_at = CURRENT_TIMESTAMP
        WHERE eh.cart_id = ${id}
          AND eh.status = 'held'
          AND EXISTS (SELECT 1 FROM transitioned)
        RETURNING eh.vendor_id, eh.amount
      ),
      payout AS (
        SELECT v.user_id, released.amount
        FROM released
        JOIN vendors v ON v.id = released.vendor_id
      ),
      credited AS (
        UPDATE wallets w
        SET balance = w.balance + payout.amount,
            updated_at = CURRENT_TIMESTAMP
        FROM payout
        WHERE w.user_id = payout.user_id
        RETURNING w.id, payout.amount
      ),
      recorded AS (
        INSERT INTO transactions (wallet_id, type, amount, reference)
        SELECT id, 'escrow_release', amount, ${`Released for cart ${id}`}
        FROM credited
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
    if (completed.length === 0) {
      return Response.json({ error: "Cart already finalized" }, { status: 409 });
    }
    if (!completed[0].financial_complete) {
      return Response.json(
        { error: "Escrow release could not be completed" },
        { status: 409 },
      );
    }

    await sql`
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        ${cart.vendor_user_id},
        'order',
        'Commande marquée reçue',
        'L''acheteur a confirmé la réception',
        '/vendor/dashboard'
      )
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error marking received:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
