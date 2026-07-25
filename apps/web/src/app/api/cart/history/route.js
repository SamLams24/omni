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
      SELECT 
        c.id,
        c.status,
        c.payment_method,
        c.note,
        c.created_at,
        c.expires_at,
        c.responded_at,
        c.completed_at,
        f.name as facility_name,
        f.id as facility_id,
        v.id as vendor_id,
        v.name as vendor_name
      FROM carts c
      JOIN facilities f ON f.id = c.facility_id
      JOIN vendors v ON v.id = f.vendor_id
      WHERE c.buyer_id = ${userId}
      ORDER BY c.created_at DESC
      LIMIT 50
    `;

    const cartIds = carts.map(c => c.id);
    let allRequests = [];
    let allDeliveries = [];
    if (cartIds.length > 0) {
      allRequests = await sql`
        SELECT 
          ar.id,
          ar.cart_id,
          ar.product_id,
          ar.quantity_requested,
          ar.quantity_confirmed,
          ar.status,
          ar.created_at,
          ar.responded_at,
          p.name as product_name,
          p.price as product_price,
          p.unit as product_unit
        FROM availability_requests ar
        JOIN products p ON p.id = ar.product_id
        WHERE ar.cart_id = ANY(${cartIds})
        ORDER BY ar.created_at ASC
      `;

      try {
        allDeliveries = await sql`
          SELECT id, cart_id, status, dropoff_address, updated_at
          FROM delivery_requests
          WHERE cart_id = ANY(${cartIds})
        `;
      } catch (delErr) {
        console.error("[cart/history] delivery query failed");
      }
    }

    const cartMap = {};
    for (const item of allRequests) {
      if (!cartMap[item.cart_id]) cartMap[item.cart_id] = [];
      cartMap[item.cart_id].push(item);
    }

    const deliveryMap = {};
    for (const d of allDeliveries) {
      deliveryMap[d.cart_id] = d;
    }

    const result = carts.map(c => ({
      ...c,
      items: cartMap[c.id] || [],
      delivery: deliveryMap[c.id] || null,
    }));

    return Response.json({ carts: result });
  } catch (error) {
    console.error("[cart/history] request failed");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
