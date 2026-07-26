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
    const { fullName, phone, idType, idNumber, vehicleType } = body;

    if (!fullName || !phone || !vehicleType) {
      return Response.json({ error: "fullName, phone, vehicleType required" }, { status: 400 });
    }
    if (!["pedestrian", "bicycle", "motorcycle", "car", "truck"].includes(vehicleType)) {
      return Response.json({ error: "Invalid vehicle type" }, { status: 400 });
    }

    const existing = await sql`
      SELECT id FROM delivery_profiles WHERE user_id = ${userId}
    `;

    let profile;
    if (existing.length > 0) {
      profile = await sql`
        UPDATE delivery_profiles SET full_name = ${fullName}, phone = ${phone}, id_type = ${idType || null}, id_number = ${idNumber || null}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}
        RETURNING id, full_name, phone, is_active, created_at
      `;
    } else {
      profile = await sql`
        INSERT INTO delivery_profiles (user_id, full_name, phone, id_type, id_number)
        VALUES (${userId}, ${fullName}, ${phone}, ${idType || null}, ${idNumber || null})
        RETURNING id, full_name, phone, is_active, created_at
      `;
    }

    await sql`UPDATE delivery_vehicles SET is_active = false WHERE delivery_profile_id = ${profile[0].id}`;
    await sql`
      INSERT INTO delivery_vehicles (delivery_profile_id, type, is_active)
      VALUES (${profile[0].id}, ${vehicleType}, true)
    `;

    return Response.json({ profile: profile[0] });
  } catch (error) {
    console.error("Error registering delivery profile:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
