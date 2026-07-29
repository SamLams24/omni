import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const body = await request.json();
    const { type } = body;

    if (!["pedestrian", "bicycle", "motorcycle", "car", "truck"].includes(type)) {
      return Response.json({ error: "Invalid vehicle type" }, { status: 400 });
    }

    const profiles = await sql`SELECT id FROM delivery_profiles WHERE user_id = ${userId}`;
    if (profiles.length === 0) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }
    const profileId = profiles[0].id;

    const existing = await sql`
      SELECT id FROM delivery_vehicles WHERE delivery_profile_id = ${profileId} AND type = ${type}
    `;
    if (existing.length > 0) {
      await sql`UPDATE delivery_vehicles SET is_active = false WHERE delivery_profile_id = ${profileId}`;
      await sql`UPDATE delivery_vehicles SET is_active = true WHERE id = ${existing[0].id}`;
      return Response.json({ success: true, reactivated: true });
    }

    await sql`UPDATE delivery_vehicles SET is_active = false WHERE delivery_profile_id = ${profileId}`;
    const result = await sql`
      INSERT INTO delivery_vehicles (delivery_profile_id, type, is_active)
      VALUES (${profileId}, ${type}, true)
      RETURNING id, type, is_active
    `;

    return Response.json({ vehicle: result[0] });
  } catch (error) {
    console.error("Error adding vehicle:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
