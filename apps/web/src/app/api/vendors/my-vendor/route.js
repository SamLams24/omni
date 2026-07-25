import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    // Get user from users table
    const userResult = await sql`
      SELECT id, vendor_tier FROM users WHERE id = ${userId}
    `;

    if (userResult.length === 0) {
      return Response.json({ vendor: null });
    }

    // Get vendor for this user
    const vendorResult = await sql`
      SELECT 
        id,
        name,
        category,
        description,
        is_online,
        ST_Y(location::geometry) as lat,
        ST_X(location::geometry) as lon,
        created_at
      FROM vendors
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    if (vendorResult.length === 0) {
      return Response.json({ vendor: null });
    }

    const vendor = { ...vendorResult[0], vendor_tier: userResult[0]?.vendor_tier || "free" };

    // Get facilities for this vendor
    const facilitiesResult = await sql`
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
        COUNT(p.id) as product_count
      FROM facilities f
      LEFT JOIN products p ON p.facility_id = f.id
      WHERE f.vendor_id = ${vendor.id}
      GROUP BY f.id, f.name, f.category, f.type, f.description, f.is_online, f.rating, f.location, f.address, f.neighborhood
      ORDER BY f.created_at ASC
    `;
    vendor.facilities = facilitiesResult;

    // Get products for this vendor
    const productsResult = await sql`
      SELECT id, name, price, unit, is_available, image_url, facility_id
      FROM products
      WHERE vendor_id = ${vendor.id}
      ORDER BY created_at DESC
    `;
    vendor.products = productsResult;

    return Response.json({ vendor });
  } catch (err) {
    console.error("GET /api/vendors/my-vendor error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
