import sql from "@/app/api/utils/sql";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";
import { getAuthenticatedUser } from "@/lib/auth";

const trackingPositions = {};

function interpolate(lat1, lon1, lat2, lon2, t) {
  return {
    lat: lat1 + (lat2 - lat1) * t,
    lon: lon1 + (lon2 - lon1) * t,
  };
}

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

    // Build route points: origin → waypoints → destination
    const routePoints = [
      { lat: Number(req.origin_lat), lon: Number(req.origin_lon) },
      ...(req.waypoints || []).map(w => ({ lat: w.lat, lon: w.lon })),
      { lat: Number(req.destination_lat), lon: Number(req.destination_lon) },
    ];

    // Find current segment
    const segmentCount = routePoints.length - 1;
    const segProgress = progress * segmentCount;
    const segIndex = Math.min(Math.floor(segProgress), segmentCount - 1);
    const segT = segProgress - segIndex;

    const from = routePoints[segIndex];
    const to = routePoints[segIndex + 1];
    const pos = from && to ? interpolate(from.lat, from.lon, to.lat, to.lon, segT) : from || to;

    const pickupLat = Number(req.pickup_lat || req.flat);
    const pickupLon = Number(req.pickup_lon || req.flon);

    return Response.json({
      deliveryRequestId: id,
      position: pos,
      pickup: { lat: pickupLat, lon: pickupLon },
      dropoff: { lat: Number(req.dropoff_lat), lon: Number(req.dropoff_lon) },
      status: progress >= 1 ? 'delivered' : req.status,
      progress: Math.round(progress * 100),
      eta: Math.round((1 - progress) * totalDuration),
    });
  } catch (error) {
    console.error("Error tracking:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
