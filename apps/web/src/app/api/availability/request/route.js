import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  CartInputError,
  parseAvailabilityRequestInput,
} from "@/domains/cart/input";

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      vendorId,
      facilityId,
      productId,
      quantity: requestedQuantity,
    } = parseAvailabilityRequestInput(await request.json());

    const products = await sql`
      SELECT
        p.id, p.vendor_id, p.facility_id, p.price,
        v.user_id AS vendor_user_id
      FROM products p
      JOIN vendors v ON v.id = p.vendor_id
      WHERE p.id = ${productId}
        AND p.vendor_id = ${vendorId}
        AND p.is_available = true
    `;
    if (
      products.length === 0
      || (facilityId && products[0].facility_id !== facilityId)
    ) {
      return Response.json(
        { error: "Product is unavailable for this vendor and facility" },
        { status: 404 },
      );
    }

    const product = products[0];
    const result = await sql`
      WITH vendor_lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${vendorId}::text))
      ),
      queue_state AS (
        SELECT CASE
          WHEN COUNT(DISTINCT COALESCE(ar.cart_id::text, ar.id::text)) < 3
            THEN 'pending'
          ELSE 'queued'
        END AS initial_status
        FROM vendor_lock
        LEFT JOIN availability_requests ar
          ON ar.vendor_id = ${vendorId}
          AND ar.status = 'pending'
          AND ar.expires_at > CURRENT_TIMESTAMP
      )
      INSERT INTO availability_requests (
        buyer_id, vendor_id, facility_id, product_id,
        quantity_requested, unit_price, status, expires_at
      )
      SELECT
        ${user.id}, ${vendorId}, ${product.facility_id}, ${productId},
        ${requestedQuantity}, ${product.price}, queue_state.initial_status,
        CURRENT_TIMESTAMP + INTERVAL '5 minutes'
      FROM queue_state
      RETURNING
        id, buyer_id, vendor_id, facility_id, product_id,
        quantity_requested, status, created_at, expires_at
    `;

    if (result[0].status === "pending") {
      await sql`
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (
          ${product.vendor_user_id},
          'request',
          'Nouvelle demande',
          ${`Quelqu'un demande: ${requestedQuantity} articles`},
          '/vendor/requests'
        )
      `;
    }

    return Response.json({ request: result[0], success: true });
  } catch (error) {
    if (error instanceof CartInputError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating availability request:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
