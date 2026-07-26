import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const conversations = await sql`
      WITH scoped AS (
        SELECT
          m.id,
          m.request_id,
          m.vendor_id,
          m.sender_id,
          m.receiver_id,
          m.content,
          m.is_read,
          m.created_at,
          p.name AS product_name,
          CASE
            WHEN m.sender_id = ${userId} THEN m.receiver_id
            ELSE m.sender_id
          END AS peer_id
        FROM messages m
        LEFT JOIN availability_requests ar ON ar.id = m.request_id
        LEFT JOIN products p ON p.id = ar.product_id
        WHERE (
          m.vendor_id IN (
            SELECT v.id FROM vendors v WHERE v.user_id = ${userId}
          )
          OR m.request_id IN (
            SELECT owned_request.id
            FROM availability_requests owned_request
            JOIN vendors v ON v.id = owned_request.vendor_id
            WHERE v.user_id = ${userId}
          )
        )
          AND (
            m.sender_id = ${userId}
            OR m.receiver_id = ${userId}
          )
      ),
      keyed AS (
        SELECT
          scoped.*,
          COALESCE(
            request_id::text,
            vendor_id::text || ':' || peer_id::text
          ) AS conversation_key
        FROM scoped
      ),
      ranked AS (
        SELECT
          keyed.*,
          ROW_NUMBER() OVER (
            PARTITION BY conversation_key
            ORDER BY created_at DESC, id DESC
          ) AS row_number,
          (
            COUNT(*) FILTER (
              WHERE receiver_id = ${userId} AND is_read = false
            ) OVER (
              PARTITION BY conversation_key
            )
          )::int AS unread_count
        FROM keyed
      )
      SELECT
        ranked.request_id,
        ranked.vendor_id,
        ranked.peer_id,
        peer.name AS peer_name,
        ranked.product_name,
        ranked.content AS last_message_preview,
        ranked.created_at AS last_message_time,
        ranked.unread_count
      FROM ranked
      JOIN users peer ON peer.id = ranked.peer_id
      WHERE ranked.row_number = 1
      ORDER BY ranked.created_at DESC
    `;

    return Response.json({ conversations });
  } catch (err) {
    console.error("GET /api/vendors/conversations error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
