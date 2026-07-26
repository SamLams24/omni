import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  CartInputError,
  normalizeConfirmedQuantity,
  parseAvailabilityResponseInput,
} from "@/domains/cart/input";
import { promoteNextAvailabilityGroup } from "@/domains/cart/queue";

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId, status, quantityConfirmed } =
      parseAvailabilityResponseInput(await request.json());

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
      await promoteNextAvailabilityGroup(availabilityRequest.vendor_id);
      return Response.json({ error: "Cette demande a expiré" }, { status: 410 });
    }

    const confirmedQuantity = normalizeConfirmedQuantity(
      status,
      quantityConfirmed,
      availabilityRequest.quantity_requested,
    );

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

    await promoteNextAvailabilityGroup(availabilityRequest.vendor_id);
    return Response.json({ request: result[0] });
  } catch (error) {
    if (error instanceof CartInputError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Error responding to availability request:", error);
    return Response.json(
      { error: "Failed to respond to request" },
      { status: 500 },
    );
  }
}
