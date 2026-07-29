import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    await sql`
      WITH owned_facilities AS (
        SELECT f.id, v.id AS vendor_id
        FROM facilities f
        JOIN vendors v ON v.id = f.vendor_id
        WHERE v.user_id = ${userId}
      ),
      expired_carts AS (
        UPDATE carts c
        SET status = 'denied', responded_at = CURRENT_TIMESTAMP
        FROM owned_facilities facility
        WHERE c.facility_id = facility.id
          AND c.status = 'pending'
          AND c.expires_at <= CURRENT_TIMESTAMP
        RETURNING c.id, facility.vendor_id
      ),
      expired_requests AS (
        UPDATE availability_requests
        SET status = 'denied', quantity_confirmed = NULL,
            responded_at = CURRENT_TIMESTAMP
        WHERE cart_id IN (SELECT id FROM expired_carts)
          AND status IN ('pending', 'queued')
        RETURNING id
      ),
      cancelled_deliveries AS (
        UPDATE delivery_requests
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE cart_id IN (SELECT id FROM expired_carts)
          AND status = 'awaiting_confirmation'
        RETURNING id
      ),
      affected_vendors AS (
        SELECT DISTINCT vendor_id FROM expired_carts
      ),
      next_groups AS (
        SELECT DISTINCT ON (ar.vendor_id)
          ar.vendor_id, ar.id, ar.cart_id
        FROM availability_requests ar
        JOIN affected_vendors av ON av.vendor_id = ar.vendor_id
        WHERE ar.status = 'queued'
          AND ar.expires_at > CURRENT_TIMESTAMP
        ORDER BY ar.vendor_id, ar.created_at ASC
      )
      UPDATE availability_requests ar
      SET status = 'pending'
      FROM next_groups ng
      WHERE
        (ng.cart_id IS NOT NULL AND ar.cart_id = ng.cart_id)
        OR (ng.cart_id IS NULL AND ar.id = ng.id)
    `;

    const carts = await sql`
      SELECT c.id, c.status, c.payment_method, c.note, c.created_at, c.expires_at,
        f.name as facility_name,
        u.name as buyer_name, u.phone as buyer_phone,
        (SELECT jsonb_agg(jsonb_build_object(
          'id', ar.id, 'product_id', ar.product_id, 'product_name', p.name,
          'product_price', COALESCE(ar.unit_price, p.price), 'product_unit', p.unit,
          'quantity_requested', ar.quantity_requested, 'status', ar.status
        )) FROM availability_requests ar
        JOIN products p ON p.id = ar.product_id
        WHERE ar.cart_id = c.id) as items
      FROM carts c
      JOIN facilities f ON f.id = c.facility_id
      JOIN vendors v ON v.id = f.vendor_id
      JOIN users u ON u.id = c.buyer_id
      WHERE v.user_id = ${userId}
        AND c.status IN ('pending', 'confirmed', 'partial')
        AND (
          c.status <> 'pending'
          OR NOT EXISTS (
            SELECT 1 FROM availability_requests pending_check
            WHERE pending_check.cart_id = c.id
              AND pending_check.status <> 'pending'
          )
        )
      ORDER BY c.created_at DESC
      LIMIT 20
    `;

    return Response.json({ carts });
  } catch (error) {
    console.error("Error fetching vendor carts:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
