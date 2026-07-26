import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

async function promoteNextGroup(vendorId) {
  await sql`
    WITH next_group AS (
      SELECT id, cart_id
      FROM availability_requests
      WHERE vendor_id = ${vendorId}
        AND status = 'queued'
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at ASC
      LIMIT 1
    )
    UPDATE availability_requests ar
    SET status = 'pending'
    FROM next_group ng
    WHERE
      (ng.cart_id IS NOT NULL AND ar.cart_id = ng.cart_id)
      OR (ng.cart_id IS NULL AND ar.id = ng.id)
  `;
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { requestId, status, quantityConfirmed } = body;
    if (!requestId || !["confirmed", "denied"].includes(status)) {
      return Response.json(
        { error: "A valid requestId and status are required" },
        { status: 400 },
      );
    }

    const requests = await sql`
      SELECT
        ar.id, ar.status, ar.expires_at, ar.vendor_id,
        ar.cart_id, ar.quantity_requested
      FROM availability_requests ar
      JOIN vendors v ON v.id = ar.vendor_id
      WHERE ar.id = ${requestId} AND v.user_id = ${user.id}
    `;
    if (requests.length === 0) {
      return Response.json({ error: "Request not found or unauthorized" }, { status: 404 });
    }

    const availabilityRequest = requests[0];
    if (availabilityRequest.cart_id) {
      return Response.json(
        { error: "Cart items must be answered through the cart response endpoint" },
        { status: 409 },
      );
    }
    if (availabilityRequest.status !== "pending") {
      return Response.json({ error: "Cette demande a déjà été traitée" }, { status: 409 });
    }

    if (
      availabilityRequest.expires_at
      && new Date(availabilityRequest.expires_at) <= new Date()
    ) {
      await sql`
        UPDATE availability_requests
        SET status = 'denied', quantity_confirmed = NULL,
            responded_at = CURRENT_TIMESTAMP
        WHERE id = ${requestId} AND status = 'pending'
      `;
      await promoteNextGroup(availabilityRequest.vendor_id);
      return Response.json({ error: "Cette demande a expiré" }, { status: 410 });
    }

    let confirmedQuantity = null;
    if (status === "confirmed") {
      confirmedQuantity = Number(quantityConfirmed);
      if (
        !Number.isInteger(confirmedQuantity)
        || confirmedQuantity < 1
        || confirmedQuantity > Number(availabilityRequest.quantity_requested)
      ) {
        return Response.json(
          { error: "Confirmed quantity is invalid" },
          { status: 400 },
        );
      }
    }

    const result = await sql`
      UPDATE availability_requests
      SET status = ${status},
          quantity_confirmed = ${confirmedQuantity},
          responded_at = CURRENT_TIMESTAMP
      WHERE id = ${requestId}
        AND status = 'pending'
        AND expires_at > CURRENT_TIMESTAMP
      RETURNING *
    `;
    if (result.length === 0) {
      return Response.json(
        { error: "Request was already processed or expired" },
        { status: 409 },
      );
    }

    await promoteNextGroup(availabilityRequest.vendor_id);
    return Response.json({ request: result[0] });
  } catch (error) {
    console.error("Error responding to availability request:", error);
    return Response.json(
      { error: "Failed to respond to request" },
      { status: 500 },
    );
  }
}
