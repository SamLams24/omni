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
    const { requestId, status, quantityConfirmed } = body;

    if (!requestId || !status) {
      return Response.json(
        { error: "requestId and status are required" },
        { status: 400 },
      );
    }

    if (!["confirmed", "denied"].includes(status)) {
      return Response.json(
        { error: "status must be 'confirmed' or 'denied'" },
        { status: 400 },
      );
    }

    // Verify vendor owns this request
    const verifyQuery = `
      SELECT ar.id, ar.status, ar.expires_at, ar.vendor_id
      FROM availability_requests ar
      JOIN vendors v ON v.id = ar.vendor_id
      WHERE ar.id = $1 AND v.user_id = $2
    `;
    const verify = await sql(verifyQuery, [requestId, userId]);
    
    if (verify.length === 0) {
      return Response.json({ error: "Request not found or unauthorized" }, { status: 404 });
    }

    if (verify[0].status !== 'pending') {
      return Response.json({ error: "Cette demande a déjà été traitée" }, { status: 400 });
    }

    if (verify[0].expires_at && new Date(verify[0].expires_at) < new Date()) {
      await sql("UPDATE availability_requests SET status = 'denied' WHERE id = $1", [requestId]);
      return Response.json({ error: "Cette demande a expiré" }, { status: 400 });
    }

    const query = `
      UPDATE availability_requests
      SET status = $1, quantity_confirmed = $2, responded_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;

    const result = await sql(query, [status, quantityConfirmed, requestId]);

    // Promote next queued request for this vendor (if any)
    await sql`
      UPDATE availability_requests
      SET status = 'pending'
      WHERE id = (
        SELECT id FROM availability_requests
        WHERE vendor_id = ${verify[0].vendor_id}
          AND status = 'queued'
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at ASC
        LIMIT 1
      )
    `;

    return Response.json({ request: result[0] });
  } catch (error) {
    console.error("Error responding to availability request:", error);
    return Response.json(
      { error: "Failed to respond to request" },
      { status: 500 },
    );
  }
}
