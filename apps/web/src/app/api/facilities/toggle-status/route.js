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
    const { facilityId, isOnline } = body;

    if (!facilityId || isOnline === undefined) {
      return Response.json(
        { error: "facilityId and isOnline are required" },
        { status: 400 },
      );
    }

    // Verify ownership through vendor
    const facility = await sql`
      SELECT f.id, f.is_online FROM facilities f
      JOIN vendors v ON v.id = f.vendor_id
      WHERE f.id = ${facilityId} AND v.user_id = ${userId}
    `;
    if (facility.length === 0) {
      return Response.json({ error: "Facility not found or unauthorized" }, { status: 404 });
    }

    const result = await sql`
      UPDATE facilities SET is_online = ${isOnline}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${facilityId}
      RETURNING id, is_online
    `;

    return Response.json({ facility: result[0] });
  } catch (error) {
    console.error("Error toggling facility status:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
