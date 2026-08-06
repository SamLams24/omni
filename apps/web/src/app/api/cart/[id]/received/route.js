import sql from "@/app/api/utils/sql";
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
      SELECT c.id, c.status, c.buyer_id, c.payment_method,
        v.user_id AS vendor_user_id
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
    if (cart.payment_method !== "cash") {
      return Response.json(
        {
          error: "Le paiement escrow n’est pas disponible.",
          code: "ESCROW_DISABLED",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
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

    const completed = await sql`
      UPDATE carts
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
        AND buyer_id = ${user.id}
        AND payment_method = 'cash'
        AND status IN ('confirmed', 'partial')
      RETURNING id
    `;
    if (completed.length === 0) {
      return Response.json({ error: "Cart already finalized" }, { status: 409 });
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
