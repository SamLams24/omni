import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  DeliveryInputError,
  parseDeliveryActionInput,
} from "@/domains/delivery/input";
import {
  hasOppositeDirection,
  resolveDeliveryPoints,
} from "@/domains/delivery/geo";

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { requestId, tripId } = parseDeliveryActionInput(
      await request.json(),
      ["requestId", "tripId"],
    );

    const profile = await sql`
      SELECT id, is_active FROM delivery_profiles WHERE user_id = ${userId}
    `;
    if (profile.length === 0) {
      return Response.json({ error: "Register as delivery person first" }, { status: 400 });
    }
    if (!profile[0].is_active) {
      return Response.json({ error: "Activate your delivery profile first" }, { status: 403 });
    }

    const ownedTrip = await sql`
      SELECT id
      FROM delivery_planned_trips
      WHERE id = ${tripId}
        AND delivery_profile_id = ${profile[0].id}
        AND is_active = true
    `;
    if (ownedTrip.length === 0) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    // Free tier limit: max 3 deliveries/day
    const userTier = await sql`
      SELECT delivery_tier FROM users WHERE id = ${userId}
    `;
    if (userTier.length === 0 || userTier[0].delivery_tier === 'free') {
      const todayCount = await sql`
        SELECT COUNT(*) as cnt FROM delivery_requests
        WHERE delivery_profile_id = ${profile[0].id}
          AND status = 'matched'
          AND updated_at >= CURRENT_DATE
      `;
      if (parseInt(todayCount[0].cnt) >= 3) {
        return Response.json(
          { error: "Free delivery limit reached (3/day). Upgrade to deliver more." },
          { status: 403 },
        );
      }
    }

    // Get new request's pickup/dropoff
    const newReq = await sql`
      SELECT pickup_lat, pickup_lon, dropoff_lat, dropoff_lon
      FROM delivery_requests
      WHERE id = ${requestId}
        AND status = 'looking'
        AND buyer_id <> ${userId}
    `;
    if (newReq.length === 0) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }

    // Already matched deliveries for this profile → conflict detection
    const existing = await sql`
      SELECT pickup_lat, pickup_lon, dropoff_lat, dropoff_lon
      FROM delivery_requests
      WHERE delivery_profile_id = ${profile[0].id}
        AND status = 'matched'
        AND id != ${requestId}
    `;

    if (existing.length > 0) {
      const newDelivery = resolveDeliveryPoints(newReq[0]);
      for (const current of existing) {
        if (
          hasOppositeDirection(
            newDelivery,
            resolveDeliveryPoints(current),
          )
        ) {
          return Response.json({
            error: "Conflit directionnel : cette livraison est en sens opposé à une livraison déjà acceptée.",
          }, { status: 409 });
        }
      }
    }

    const result = await sql`
      UPDATE delivery_requests
      SET status = 'matched', matched_trip_id = ${tripId}, delivery_profile_id = ${profile[0].id}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${requestId} AND status = 'looking'
      RETURNING *
    `;

    if (result.length === 0) {
      return Response.json({ error: "Request already taken or not available" }, { status: 409 });
    }

    return Response.json({ request: result[0] });
  } catch (error) {
    if (error instanceof DeliveryInputError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Error accepting delivery:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
