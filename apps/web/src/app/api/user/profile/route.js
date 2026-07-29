import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const result = await sql`
      SELECT id, name, email, phone, lat, lon, preferred_language
      FROM users WHERE id = ${userId}
    `;

    if (result.length === 0) {
      return Response.json({ user: null });
    }

    return Response.json({ user: result[0] });
  } catch (err) {
    console.error("GET /api/user/profile error:", err);
    return Response.json({ user: null });
  }
}

export async function PUT(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const body = await request.json();
    const { name, phone, lat, lon, preferred_language } = body;

    const updates = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
    if (phone !== undefined) { updates.push(`phone = $${idx++}`); values.push(phone); }
    if (lat !== undefined) { updates.push(`lat = $${idx++}`); values.push(lat); }
    if (lon !== undefined) { updates.push(`lon = $${idx++}`); values.push(lon); }
    if (preferred_language !== undefined) { updates.push(`preferred_language = $${idx++}`); values.push(preferred_language); }

    if (updates.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result = await sql(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx}
       RETURNING id, name, email, phone, lat, lon, preferred_language`,
      values
    );

    if (result.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({ user: result[0], success: true });
  } catch (err) {
    console.error("PUT /api/user/profile error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
