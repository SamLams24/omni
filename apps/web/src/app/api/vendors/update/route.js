import sql from "@/app/api/utils/sql";
import {
  CatalogInputError,
  parseVendorUpdateInput,
  readCatalogRequest,
} from "@/domains/catalog/input";
import { getAuthenticatedUser } from "@/lib/auth";

export async function PUT(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { vendorId, fields } = await readCatalogRequest(
      request,
      parseVendorUpdateInput,
    );

    const sets = [];
    const values = [];
    let idx = 1;

    for (const field of [
      "name",
      "category",
      "description",
      "phone",
      "email",
      "address",
      "neighborhood",
    ]) {
      if (field in fields) {
        sets.push(`${field} = $${idx++}`);
        values.push(fields[field]);
      }
    }
    if (fields.location) {
      sets.push(`location = ST_SetSRID(ST_Point($${idx++}, $${idx++}), 4326)`);
      values.push(fields.location.lon, fields.location.lat);
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
    if (err instanceof CatalogInputError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("PUT /api/vendors/update error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
