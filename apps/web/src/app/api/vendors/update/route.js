import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function PUT(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const body = await request.json();
    const { vendorId, name, category, description, phone, email, address, neighborhood, lat, lon } = body;

    if (!vendorId) {
      return Response.json({ error: "vendorId required" }, { status: 400 });
    }

    const sets = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); values.push(name); }
    if (category !== undefined) { sets.push(`category = $${idx++}`); values.push(category); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); values.push(description); }
    if (phone !== undefined) { sets.push(`phone = $${idx++}`); values.push(phone); }
    if (email !== undefined) { sets.push(`email = $${idx++}`); values.push(email); }
    if (address !== undefined) { sets.push(`address = $${idx++}`); values.push(address); }
    if (neighborhood !== undefined) { sets.push(`neighborhood = $${idx++}`); values.push(neighborhood); }
    if (lat !== undefined && lon !== undefined) {
      sets.push(`location = ST_SetSRID(ST_Point($${idx++}, $${idx++}), 4326)`);
      values.push(lon, lat);
    }

    if (sets.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(vendorId, userId);

    const result = await sql(
      `UPDATE vendors SET ${sets.join(", ")}
       WHERE id = $${idx} AND user_id = $${idx + 1}
       RETURNING id, name, category, description, phone, email, address, neighborhood, is_online`,
      values
    );

    if (result.length === 0) {
      return Response.json({ error: "Vendor not found or unauthorized" }, { status: 404 });
    }

    return Response.json({ vendor: result[0], success: true });
  } catch (err) {
    console.error("PUT /api/vendors/update error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
