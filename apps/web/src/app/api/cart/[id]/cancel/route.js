import sql from "@/app/api/utils/sql";
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
      SELECT c.id, c.status, c.buyer_id, c.payment_method, f.vendor_id
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
    if (cart.payment_method !== "cash") {
      return Response.json(
        {
          error: "Le paiement escrow n’est pas disponible.",
          code: "ESCROW_DISABLED",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
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

    const cancelled = await sql`
      WITH transitioned AS (
        UPDATE carts
        SET status = 'cancelled'
        WHERE id = ${id}
          AND buyer_id = ${user.id}
          AND payment_method = 'cash'
          AND status IN ('pending', 'confirmed', 'partial', 'denied')
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
      SELECT transitioned.id
      FROM transitioned
    `;
    if (cancelled.length === 0) {
      return Response.json({ error: "Cart already finalized" }, { status: 409 });
    }
    await promoteNextAvailabilityGroup(cart.vendor_id);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error cancelling cart:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
