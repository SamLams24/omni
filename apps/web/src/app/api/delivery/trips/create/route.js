import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  DeliveryInputError,
  parseTripInput,
} from "@/domains/delivery/input";

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const profile = await sql`SELECT id FROM delivery_profiles WHERE user_id = ${userId}`;
    if (profile.length === 0) {
      return Response.json({ error: "Register as delivery person first" }, { status: 400 });
    }

    const userTier = await sql`SELECT delivery_tier FROM users WHERE id = ${userId}`;
    const freeTier = (
      userTier.length === 0 || userTier[0].delivery_tier === "free"
    );
    const {
      origin,
      destination,
      waypoints,
      deviationKm,
      departureTime,
    } = parseTripInput(await request.json(), { freeTier });

    const waypointsJson = JSON.stringify(waypoints);
    const trip = await sql`
      INSERT INTO delivery_planned_trips (delivery_profile_id, origin_lat, origin_lon, destination_lat, destination_lon, waypoints, deviation_km, departure_time)
      VALUES (${profile[0].id}, ${origin.lat}, ${origin.lon}, ${destination.lat}, ${destination.lon},
              ${waypointsJson}::jsonb, ${deviationKm}, ${departureTime})
      RETURNING *
    `;

    return Response.json({ trip: trip[0] });
  } catch (error) {
    if (error instanceof DeliveryInputError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating trip:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
