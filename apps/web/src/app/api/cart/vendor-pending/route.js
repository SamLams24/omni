import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const carts = await sql`
      SELECT c.id, c.status, c.payment_method, c.note, c.created_at, c.expires_at,
        f.name as facility_name,
        u.name as buyer_name, u.phone as buyer_phone,
        (SELECT jsonb_agg(jsonb_build_object(
          'id', ar.id, 'product_id', ar.product_id, 'product_name', p.name,
          'product_price', p.price, 'product_unit', p.unit,
          'quantity_requested', ar.quantity_requested, 'status', ar.status
        )) FROM availability_requests ar
        JOIN products p ON p.id = ar.product_id
        WHERE ar.cart_id = c.id) as items
      FROM carts c
      JOIN facilities f ON f.id = c.facility_id
      JOIN vendors v ON v.id = f.vendor_id
      JOIN users u ON u.id = c.buyer_id
      WHERE v.user_id = ${userId}
        AND c.status IN ('pending', 'confirmed', 'partial')
      ORDER BY c.created_at DESC
      LIMIT 20
    `;

    return Response.json({ carts });
  } catch (error) {
    console.error("Error fetching vendor carts:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
