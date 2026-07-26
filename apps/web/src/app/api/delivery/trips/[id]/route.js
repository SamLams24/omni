import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { id } = await params;
    const trips = await sql`
      SELECT id, origin_lat, origin_lon, destination_lat, destination_lon,
        waypoints, deviation_km, is_active, created_at
      FROM delivery_planned_trips
      WHERE id = ${id} AND delivery_profile_id = (
        SELECT id FROM delivery_profiles WHERE user_id = ${userId}
      )
    `;

    if (trips.length === 0) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    return Response.json({ trip: trips[0] });
  } catch (error) {
    console.error("Error fetching trip:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { id } = await params;
    const body = await request.json();
    const { originLat, originLon, destinationLat, destinationLon, waypoints, deviationKm } = body;

    if (!originLat || !originLon || !destinationLat || !destinationLon) {
      return Response.json({ error: "origin and destination required" }, { status: 400 });
    }

    const result = await sql`
      UPDATE delivery_planned_trips SET
        origin_lat = ${originLat}, origin_lon = ${originLon},
        destination_lat = ${destinationLat}, destination_lon = ${destinationLon},
        waypoints = ${JSON.stringify(waypoints || [])}::jsonb,
        deviation_km = ${deviationKm || 2}
      WHERE id = ${id} AND delivery_profile_id = (
        SELECT id FROM delivery_profiles WHERE user_id = ${userId}
      )
      RETURNING id, origin_lat, origin_lon, destination_lat, destination_lon, waypoints, deviation_km
    `;

    if (result.length === 0) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    return Response.json({ trip: result[0] });
  } catch (error) {
    console.error("Error updating trip:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
