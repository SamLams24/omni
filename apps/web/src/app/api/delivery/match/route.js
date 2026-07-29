import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  buildRoutePoints,
  distanceToRouteMeters,
  resolveDeliveryPoints,
} from "@/domains/delivery/geo";
import {
  DeliveryInputError,
  parseDeliveryActionInput,
} from "@/domains/delivery/input";

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { tripId } = parseDeliveryActionInput(
      await request.json(),
      ["tripId"],
    );

    const trips = await sql`
      SELECT dpt.*
      FROM delivery_planned_trips dpt
      JOIN delivery_profiles dp ON dp.id = dpt.delivery_profile_id
      WHERE dpt.id = ${tripId}
        AND dp.user_id = ${userId}
        AND dpt.is_active = true
    `;
    if (trips.length === 0) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    const trip = trips[0];
    const points = buildRoutePoints(trip);

    const requests = await sql`
      SELECT
        dr.id,
        dr.cart_id,
        dr.facility_id,
        dr.pickup_lat,
        dr.pickup_lon,
        dr.dropoff_lat,
        dr.dropoff_lon,
        dr.dropoff_address,
        dr.delivery_fee,
        f.name as facility_name,
        ST_Y(f.location::geometry) as facility_lat,
        ST_X(f.location::geometry) as facility_lon
      FROM delivery_requests dr
      JOIN facilities f ON f.id = dr.facility_id
      WHERE dr.status = 'looking'
        AND dr.buyer_id <> ${userId}
    `;

    const matches = [];
    for (const req of requests) {
      const { pickup, dropoff } = resolveDeliveryPoints(req);
      if (!pickup) continue;

      let minDist = distanceToRouteMeters(pickup, points);
      if (dropoff) {
        minDist = Math.min(
          minDist,
          distanceToRouteMeters(dropoff, points),
        );
      }

      const deviationM = Number(trip.deviation_km) * 1000;
      if (minDist <= deviationM) {
        matches.push({ request: req, distanceToRoute: Math.round(minDist) });
      }
    }

    matches.sort((a, b) => a.distanceToRoute - b.distanceToRoute);

    return Response.json({ matches, count: matches.length });
  } catch (error) {
    if (error instanceof DeliveryInputError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Error matching:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
