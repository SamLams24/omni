import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const trips = await sql`
      SELECT dpt.* FROM delivery_planned_trips dpt
      JOIN delivery_profiles dp ON dp.id = dpt.delivery_profile_id
      WHERE dp.user_id = ${userId} AND dpt.is_active = true
      ORDER BY dpt.created_at DESC
    `;

    const parsed = trips.map((t) => ({
      ...t,
      origin_lat: t.origin_lat != null ? Number(t.origin_lat) : null,
      origin_lon: t.origin_lon != null ? Number(t.origin_lon) : null,
      destination_lat: t.destination_lat != null ? Number(t.destination_lat) : null,
      destination_lon: t.destination_lon != null ? Number(t.destination_lon) : null,
      deviation_km: t.deviation_km != null ? Number(t.deviation_km) : null,
      waypoints: Array.isArray(t.waypoints)
        ? t.waypoints.map((wp) => ({
            ...wp,
            lat: wp.lat != null ? Number(wp.lat) : null,
            lon: wp.lon != null ? Number(wp.lon) : null,
          }))
        : t.waypoints,
    }));

    return Response.json({ trips: parsed });
  } catch (error) {
    console.error("Error fetching active trips:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
