import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

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

    const body = await request.json();
    let { originLat, originLon, destinationLat, destinationLon, waypoints, deviationKm, departureTime } = body;

    if (!originLat || !originLon || !destinationLat || !destinationLon) {
      return Response.json({ error: "origin and destination required" }, { status: 400 });
    }

    // Free tier: rayon only (no waypoints, no deviation)
    const userTier = await sql`SELECT delivery_tier FROM users WHERE id = ${userId}`;
    if (userTier.length === 0 || userTier[0].delivery_tier === 'free') {
      waypoints = [];
      deviationKm = 0;
    }

    const waypointsJson = JSON.stringify(waypoints || []);
    const trip = await sql`
      INSERT INTO delivery_planned_trips (delivery_profile_id, origin_lat, origin_lon, destination_lat, destination_lon, waypoints, deviation_km, departure_time)
      VALUES (${profile[0].id}, ${originLat}, ${originLon}, ${destinationLat}, ${destinationLon},
              ${waypointsJson}::jsonb, ${deviationKm || 2.0}, ${departureTime || null})
      RETURNING *
    `;

    return Response.json({ trip: trip[0] });
  } catch (error) {
    console.error("Error creating trip:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
