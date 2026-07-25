import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const favorites = await sql`
      SELECT 
        v.id, v.name, v.category,
        ST_Y(v.location::geometry) as lat,
        ST_X(v.location::geometry) as lon
      FROM favorites f
      JOIN vendors v ON v.id = f.vendor_id
      WHERE f.user_id = ${userId}
      ORDER BY f.created_at DESC
    `;

    return Response.json({ favorites });
  } catch (err) {
    console.error("GET /api/favorites error:", err);
    return Response.json({ favorites: [] });
  }
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { vendorId } = await request.json();
    
    await sql`
      INSERT INTO favorites (user_id, vendor_id)
      VALUES (${userId}, ${vendorId})
      ON CONFLICT (user_id, vendor_id) DO NOTHING
    `;

    return Response.json({ success: true });
  } catch (err) {
    console.error("POST /api/favorites error:", err);
    return Response.json({ error: "Failed to add favorite" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const url = new URL(request.url);
    const vendorId = url.searchParams.get("vendorId");
    
    await sql`
      DELETE FROM favorites 
      WHERE user_id = ${userId} AND vendor_id = ${vendorId}
    `;

    return Response.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/favorites error:", err);
    return Response.json({ error: "Failed to remove favorite" }, { status: 500 });
  }
}
