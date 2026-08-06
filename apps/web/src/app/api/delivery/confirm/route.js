import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const body = await request.json();
    const { requestId } = body;
    if (!requestId) {
      return Response.json({ error: "requestId is required" }, { status: 400 });
    }

    const deliveryReqs = await sql`
      SELECT dr.id, dr.status, c.payment_method, c.status AS cart_status
      FROM delivery_requests dr
      JOIN carts c ON c.id = dr.cart_id
      WHERE dr.id = ${requestId} AND dr.delivery_profile_id = (
        SELECT id FROM delivery_profiles WHERE user_id = ${userId}
      )
    `;
    if (deliveryReqs.length === 0) {
      return Response.json({ error: "Delivery request not found or unauthorized" }, { status: 404 });
    }

    const req = deliveryReqs[0];
    if (req.payment_method !== "cash") {
      return Response.json(
        {
          error: "Le paiement escrow n’est pas disponible.",
          code: "ESCROW_DISABLED",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!["matched", "picked_up", "in_transit"].includes(req.status)) {
      return Response.json(
        { error: `Cannot confirm delivery: status is '${req.status}'` },
        { status: 409 },
      );
    }
    if (!["confirmed", "partial"].includes(req.cart_status)) {
      return Response.json(
        { error: "Cart is not ready for delivery completion" },
        { status: 409 },
      );
    }

    const completed = await sql`
      WITH delivered AS (
        UPDATE delivery_requests dr
        SET status = 'delivered', updated_at = CURRENT_TIMESTAMP
        WHERE dr.id = ${requestId}
          AND dr.delivery_profile_id = (
            SELECT id FROM delivery_profiles WHERE user_id = ${userId}
          )
          AND dr.status IN ('matched', 'picked_up', 'in_transit')
          AND EXISTS (
            SELECT 1
            FROM carts c
            WHERE c.id = dr.cart_id
              AND c.payment_method = 'cash'
              AND c.status IN ('confirmed', 'partial')
          )
        RETURNING dr.id, dr.cart_id, dr.buyer_id
      ),
      completed_cart AS (
        UPDATE carts c
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        FROM delivered d
        WHERE c.id = d.cart_id
          AND c.payment_method = 'cash'
          AND c.status IN ('confirmed', 'partial')
        RETURNING c.id
      ),
      notified AS (
        INSERT INTO notifications (user_id, type, title, message, link)
        SELECT
          d.buyer_id,
          'delivery',
          'Livraison confirmée',
          'Votre colis a été livré',
          '/cart/history'
        FROM delivered d
        RETURNING id
      )
      SELECT
        d.id,
        EXISTS (SELECT 1 FROM completed_cart) AS cart_completed,
        EXISTS (SELECT 1 FROM notified) AS notification_created
      FROM delivered d
    `;
    if (
      completed.length === 0
      || !completed[0].cart_completed
      || !completed[0].notification_created
    ) {
      return Response.json(
        { error: "Delivery was already completed or changed" },
        { status: 409 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error confirming delivery:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
