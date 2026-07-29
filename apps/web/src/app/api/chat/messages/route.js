import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  ChatInputError,
  parseConversationReference,
  parseMessageInput,
} from "@/domains/chat/input";
import {
  getRequestReceiver,
  isRequestParticipant,
  resolveVendorPeer,
} from "@/domains/chat/participants";

async function getRequestParticipants(requestId) {
  const [participants] = await sql`
    SELECT ar.buyer_id, v.user_id as vendor_user_id
    FROM availability_requests ar
    JOIN vendors v ON v.id = ar.vendor_id
    WHERE ar.id = ${requestId}
  `;
  return participants || null;
}

async function getVendor(vendorId) {
  const [vendor] = await sql`
    SELECT id, user_id FROM vendors WHERE id = ${vendorId}
  `;
  return vendor || null;
}

async function vendorConversationExists(vendorId, userId, peerId) {
  const existing = await sql`
    SELECT id
    FROM messages
    WHERE vendor_id = ${vendorId}
      AND (
        (sender_id = ${userId} AND receiver_id = ${peerId})
        OR (sender_id = ${peerId} AND receiver_id = ${userId})
      )
    LIMIT 1
  `;
  return existing.length > 0;
}

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const { requestId, vendorId, peerId } =
      parseConversationReference(searchParams);

    let messages;

    if (requestId) {
      const participants = await getRequestParticipants(requestId);
      if (!isRequestParticipant(participants, userId)) {
        return Response.json({ error: "Conversation not found" }, { status: 404 });
      }

      messages = await sql`
        SELECT * FROM (
          SELECT
            m.id,
            m.content,
            m.created_at,
            m.sender_id,
            sender.name AS sender_name,
            CASE WHEN m.sender_id = ${userId}
              THEN true ELSE false
            END AS is_mine
          FROM messages m
          JOIN users sender ON sender.id = m.sender_id
          WHERE m.request_id = ${requestId}
          ORDER BY m.created_at DESC, m.id DESC
          LIMIT 100
        ) recent
        ORDER BY recent.created_at ASC, recent.id ASC
      `;

      await sql`
        UPDATE messages
        SET is_read = true
        WHERE request_id = ${requestId}
          AND receiver_id = ${userId}
          AND is_read = false
      `;
    } else {
      const vendor = await getVendor(vendorId);
      if (!vendor) {
        return Response.json({ error: "Vendor not found" }, { status: 404 });
      }
      const conversationPeerId = resolveVendorPeer(
        vendor.user_id,
        userId,
        peerId,
      );
      if (
        vendor.user_id === userId
        && !await vendorConversationExists(
          vendorId,
          userId,
          conversationPeerId,
        )
      ) {
        return Response.json({ error: "Conversation not found" }, { status: 404 });
      }

      messages = await sql`
        SELECT * FROM (
          SELECT
            m.id,
            m.content,
            m.created_at,
            m.sender_id,
            sender.name AS sender_name,
            CASE WHEN m.sender_id = ${userId}
              THEN true ELSE false
            END AS is_mine
          FROM messages m
          JOIN users sender ON sender.id = m.sender_id
          WHERE m.vendor_id = ${vendorId}
            AND (
              (m.sender_id = ${userId}
                AND m.receiver_id = ${conversationPeerId})
              OR (m.sender_id = ${conversationPeerId}
                AND m.receiver_id = ${userId})
            )
          ORDER BY m.created_at DESC, m.id DESC
          LIMIT 100
        ) recent
        ORDER BY recent.created_at ASC, recent.id ASC
      `;

      await sql`
        UPDATE messages
        SET is_read = true
        WHERE vendor_id = ${vendorId}
          AND sender_id = ${conversationPeerId}
          AND receiver_id = ${userId}
          AND is_read = false
      `;
    }

    return Response.json({ messages });
  } catch (err) {
    if (err instanceof ChatInputError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/chat/messages error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const {
      requestId,
      vendorId,
      peerId,
      content,
    } = parseMessageInput(await request.json());

    let receiverId;
    let result;

    if (requestId) {
      const participants = await getRequestParticipants(requestId);
      if (!isRequestParticipant(participants, userId)) {
        return Response.json({ error: "Conversation not found" }, { status: 404 });
      }
      receiverId = getRequestReceiver(participants, userId);

      result = await sql`
        INSERT INTO messages (request_id, sender_id, receiver_id, content)
        VALUES (${requestId}, ${userId}, ${receiverId}, ${content})
        RETURNING id, content, created_at, sender_id
      `;
    } else {
      const vendor = await getVendor(vendorId);
      if (!vendor) {
        return Response.json({ error: "Vendor not found" }, { status: 404 });
      }
      receiverId = resolveVendorPeer(vendor.user_id, userId, peerId);
      if (
        vendor.user_id === userId
        && !await vendorConversationExists(vendorId, userId, receiverId)
      ) {
        return Response.json({ error: "Conversation not found" }, { status: 404 });
      }

      result = await sql`
        INSERT INTO messages (vendor_id, sender_id, receiver_id, content)
        VALUES (${vendorId}, ${userId}, ${receiverId}, ${content})
        RETURNING id, content, created_at, sender_id
      `;
    }

    const message = result[0];
    return Response.json({ message, success: true });
  } catch (err) {
    if (err instanceof ChatInputError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/chat/messages error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
