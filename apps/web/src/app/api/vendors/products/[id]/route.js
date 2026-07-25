import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function PUT(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { id } = params;
    const body = await request.json();
    const { vendorId, name, price, unit, isAvailable } = body;

    // Verify vendor ownership
    const vendorCheck = await sql`
      SELECT v.id 
      FROM vendors v
      WHERE v.id = ${vendorId} AND v.user_id = ${userId}
    `;

    if (vendorCheck.length === 0) {
      return Response.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      values.push(price);
    }
    if (unit !== undefined) {
      updates.push(`unit = $${paramIndex++}`);
      values.push(unit);
    }
    if (isAvailable !== undefined) {
      updates.push(`is_available = $${paramIndex++}`);
      values.push(isAvailable);
    }

    if (updates.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id);
    values.push(vendorId);

    const query = `
      UPDATE products
      SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex++} AND vendor_id = $${paramIndex}
      RETURNING id, vendor_id, name, price, unit, is_available, created_at
    `;

    const result = await sql(query, values);

    if (result.length === 0) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    return Response.json({ product: result[0], success: true });
  } catch (err) {
    console.error("PUT /api/vendors/products/[id] error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
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

    // Verify ownership before deleting
    const result = await sql`
      DELETE FROM products p
      USING vendors v
      WHERE p.id = ${id}
        AND p.vendor_id = v.id
        AND v.user_id = ${userId}
      RETURNING p.id
    `;

    if (result.length === 0) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/vendors/products/[id] error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
