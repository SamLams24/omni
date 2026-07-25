import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const facilityQuery = `
      SELECT 
        f.id,
        f.name as facility_name,
        f.category,
        f.type,
        f.description,
        f.is_online,
        f.rating,
        ST_Y(f.location::geometry) as lat,
        ST_X(f.location::geometry) as lon,
        f.address,
        f.neighborhood,
        v.id as vendor_id,
        v.name as vendor_name,
        v.email,
        v.phone
      FROM facilities f
      JOIN vendors v ON v.id = f.vendor_id
      WHERE f.id = $1
    `;

    const productQuery = `
      SELECT id, name, description, price, currency, unit, image_url
      FROM products
      WHERE facility_id = $1
      ORDER BY name
    `;

    const [facilities, products] = await Promise.all([
      sql(facilityQuery, [id]),
      sql(productQuery, [id]),
    ]);

    if (facilities.length === 0) {
      return Response.json({ error: "Facility not found" }, { status: 404 });
    }

    const facility = { ...facilities[0], products };
    return Response.json({ facility });
  } catch (error) {
    console.error("Error fetching facility:", error);
    return Response.json({ error: "Failed to fetch facility details" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { id } = params;
    const body = await request.json();
    const { name, category, type, description, address, neighborhood } = body;

    const facility = await sql`
      SELECT f.id FROM facilities f
      JOIN vendors v ON v.id = f.vendor_id
      WHERE f.id = ${id} AND v.user_id = ${userId}
    `;
    if (facility.length === 0) {
      return Response.json({ error: "Facility not found or unauthorized" }, { status: 404 });
    }

    const updates = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) { updates.push("name = $" + idx++); values.push(name); }
    if (category !== undefined) { updates.push("category = $" + idx++); values.push(category); }
    if (type !== undefined) { updates.push("type = $" + idx++); values.push(type); }
    if (description !== undefined) { updates.push("description = $" + idx++); values.push(description); }
    if (address !== undefined) { updates.push("address = $" + idx++); values.push(address); }
    if (neighborhood !== undefined) { updates.push("neighborhood = $" + idx++); values.push(neighborhood); }
    if (updates.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }
    values.push(id);
    const query = "UPDATE facilities SET " + updates.join(", ") + ", updated_at = CURRENT_TIMESTAMP WHERE id = $" + idx + " RETURNING id, name as facility_name, category, type, description, address, neighborhood";
    const result = await sql(query, values);
    return Response.json({ facility: result[0], success: true });
  } catch (error) {
    console.error("Error updating facility:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { id } = params;
    const result = await sql`
      DELETE FROM facilities f
      USING vendors v
      WHERE f.id = ${id} AND f.vendor_id = v.id AND v.user_id = ${userId}
      RETURNING f.id
    `;
    if (result.length === 0) {
      return Response.json({ error: "Facility not found" }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting facility:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
