import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    // Auto-expire requests past their deadline
    await sql`
      UPDATE availability_requests
      SET status = 'denied'
      WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
    `;

    // Promote queued requests for vendors with open slots (< 3 pending)
    await sql`
      UPDATE availability_requests
      SET status = 'pending'
      WHERE id IN (
        SELECT q.id FROM availability_requests q
        WHERE q.status = 'queued'
          AND q.expires_at > CURRENT_TIMESTAMP
          AND (
            SELECT COUNT(*) FROM availability_requests a
            WHERE a.vendor_id = q.vendor_id
              AND a.status = 'pending'
              AND a.expires_at > CURRENT_TIMESTAMP
          ) < 3
        ORDER BY q.created_at ASC
      )
    `;

    // Get all availability requests for this vendor
    const requests = await sql`
      SELECT 
        ar.id,
        ar.quantity_requested,
        ar.quantity_confirmed,
        ar.status,
        ar.created_at,
        ar.responded_at,
        p.name as product_name,
        p.unit as product_unit,
        p.price as product_price
      FROM availability_requests ar
      JOIN products p ON p.id = ar.product_id
      JOIN vendors v ON v.id = ar.vendor_id
      WHERE v.user_id = ${userId}
      ORDER BY ar.created_at DESC
      LIMIT 100
    `;

    return Response.json({ requests });
  } catch (err) {
    console.error("GET /api/vendors/requests error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
