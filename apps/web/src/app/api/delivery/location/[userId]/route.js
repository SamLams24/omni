import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;
    if (userId !== user.id) {
      return Response.json({ error: "Location not found" }, { status: 404 });
    }

    const profile = await sql`
      SELECT
        ST_Y(current_location::geometry) as lat,
        ST_X(current_location::geometry) as lon,
        location_updated_at
      FROM delivery_profiles WHERE user_id = ${userId}
    `;

    if (profile.length === 0 || profile[0].lat == null || profile[0].lon == null) {
      return Response.json({ error: "Location not found" }, { status: 404 });
    }

    return Response.json({
      lat: Number(profile[0].lat),
      lon: Number(profile[0].lon),
      updated_at: profile[0].location_updated_at,
    });
  } catch (error) {
    console.error("Error fetching delivery location:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
