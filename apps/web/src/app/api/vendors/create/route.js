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
    const { name, category, description, lat, lon, products, phone } = body;

    console.log('[Create Vendor] Request:', { name, category, lat, lon });

    if (!name || !category || !lat || !lon) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check if user already has a vendor
    const existingVendor = await sql`
      SELECT id FROM vendors WHERE user_id = ${userId}::uuid
    `;
    
    if (existingVendor.length > 0) {
      console.log('[Create Vendor] User already has vendor');
      return Response.json({ error: "User already has a vendor" }, { status: 400 });
    }

    // Insert vendor
    const query = `
      INSERT INTO vendors (name, category, description, location, user_id, is_online, phone, created_at, updated_at)
      VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, true, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;
    console.log('[Create Vendor] Inserting vendor...');
    
    const insertResult = await sql(query, [name, category, description || null, lon, lat, userId, phone || '+22800000000']);
    console.log('[Create Vendor] Insert result:', insertResult);

    if (!insertResult.length) {
      return Response.json({ error: "Failed to create vendor" }, { status: 500 });
    }

    const vendorId = insertResult[0].id;

    // Create a default facility with the same info
    const facilityResult = await sql`
      INSERT INTO facilities (vendor_id, name, category, type, description, location)
      VALUES (
        ${vendorId}, ${name}, ${category}, 'fixed', ${description || null},
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)
      )
      RETURNING id
    `;
    const facilityId = facilityResult[0].id;

    // Insert products if provided
    if (products && products.length > 0) {
      for (const product of products) {
        if (product.name && product.price) {
          await sql(
            `INSERT INTO products (vendor_id, facility_id, name, price, unit, is_available)
             VALUES ($1, $2, $3, $4, true)`,
            [vendorId, facilityId, product.name, product.price, product.unit || 'pièce']
          );
        }
      }
    }

    console.log('[Create Vendor] Success!');
    return Response.json({ success: true, vendorId, facilityId });
  } catch (error) {
    console.error("[Create Vendor] Error:", error);
    return Response.json({ 
      error: "Failed to create vendor", 
      details: error.message 
    }, { status: 500 });
  }
}
