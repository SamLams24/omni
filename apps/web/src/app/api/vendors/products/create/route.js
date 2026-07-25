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
    const { vendorId, facilityId, name, price, unit } = body;

    if (!vendorId || !name || !price) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Verify vendor ownership
    const vendorCheck = await sql`
      SELECT v.id 
      FROM vendors v
      WHERE v.id = ${vendorId} AND v.user_id = ${userId}
    `;

    if (vendorCheck.length === 0) {
      return Response.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Free tier limit: max 5 products per vendor
    const userTier = await sql`
      SELECT vendor_tier FROM users WHERE id = ${userId}
    `;
    if (userTier.length === 0 || userTier[0].vendor_tier === 'free') {
      const productCount = await sql`
        SELECT COUNT(*) as cnt FROM products WHERE vendor_id = ${vendorId}
      `;
      if (parseInt(productCount[0].cnt) >= 5) {
        return Response.json(
          { error: "Free vendors can only have 5 products. Subscribe to add more." },
          { status: 403 },
        );
      }
    }

    const result = await sql`
      INSERT INTO products (vendor_id, facility_id, name, price, unit, is_available)
      VALUES (
        ${vendorId},
        ${facilityId || null},
        ${name},
        ${price},
        ${unit || "pièce"},
        true
      )
      RETURNING id, vendor_id, name, price, unit, is_available, created_at
    `;

    return Response.json({ product: result[0], success: true });
  } catch (err) {
    console.error("POST /api/vendors/products/create error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
