import sql from "@/app/api/utils/sql";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  buildRoutePoints,
  interpolateRoutePosition,
  resolveDeliveryPoints,
} from "@/domains/delivery/geo";
import { DeliveryInputError } from "@/domains/delivery/input";

const trackingPositions = {};

export async function GET(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const disabled = requireNonProductionFeature("ENABLE_MOCK_DELIVERY_TRACKING");
    if (disabled) return disabled;

    const { id } = await params;

    const requests = await sql`
      SELECT dr.*, 
        ST_Y(f.location::geometry) as flat, ST_X(f.location::geometry) as flon,
        dpt.origin_lat, dpt.origin_lon, dpt.destination_lat, dpt.destination_lon,
        dpt.waypoints
      FROM delivery_requests dr
      JOIN facilities f ON f.id = dr.facility_id
      JOIN delivery_planned_trips dpt ON dpt.id = dr.matched_trip_id
      WHERE dr.id = ${id} AND dr.status IN ('matched', 'picked_up', 'in_transit')
        AND (
          dr.buyer_id = ${userId}
          OR dr.delivery_profile_id = (
            SELECT id FROM delivery_profiles WHERE user_id = ${userId}
          )
        )
    `;

    if (requests.length === 0) {
      return Response.json({ error: "No active delivery found" }, { status: 404 });
    }

    const req = requests[0];
    const now = Date.now();

    if (!trackingPositions[id]) {
      trackingPositions[id] = { startTime: now, progress: 0 };
    }

    const track = trackingPositions[id];
    const elapsed = (now - track.startTime) / 1000;
    const totalDuration = 300; // 5 min mock delivery
    let progress = Math.min(elapsed / totalDuration, 1);
    if (progress >= 1) progress = 1;
    track.progress = progress;

    const routePoints = buildRoutePoints(req);
    const position = interpolateRoutePosition(routePoints, progress);
    const { pickup, dropoff } = resolveDeliveryPoints(req);

    return Response.json({
      deliveryRequestId: id,
      position,
      pickup,
      dropoff,
      status: progress >= 1 ? 'delivered' : req.status,
      progress: Math.round(progress * 100),
      eta: Math.round((1 - progress) * totalDuration),
    });
  } catch (error) {
    if (error instanceof DeliveryInputError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Error tracking:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
