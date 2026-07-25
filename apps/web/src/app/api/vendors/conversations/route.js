import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    // Get all conversations for this vendor
    const conversations = await sql`
      SELECT DISTINCT ON (COALESCE(m.request_id::text, m.vendor_id::text))
        m.request_id,
        m.vendor_id,
        p.name as product_name,
        m.content as last_message_preview,
        m.created_at as last_message_time
      FROM messages m
      LEFT JOIN availability_requests ar ON ar.id = m.request_id
      LEFT JOIN products p ON p.id = ar.product_id
      WHERE (
        m.vendor_id IN (SELECT v.id FROM vendors v WHERE v.user_id = ${userId})
        OR (
          m.request_id IS NOT NULL
          AND m.request_id IN (
            SELECT ar.id FROM availability_requests ar
            JOIN vendors v ON v.id = ar.vendor_id
            WHERE v.user_id = ${userId}
          )
        )
      )
      ORDER BY COALESCE(m.request_id::text, m.vendor_id::text), m.created_at DESC
    `;

    return Response.json({ conversations });
  } catch (err) {
    console.error("GET /api/vendors/conversations error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
