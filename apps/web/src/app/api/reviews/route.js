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
    const { facilityId, rating, comment } = body;

    if (!facilityId || !rating || rating < 1 || rating > 5) {
      return Response.json({ error: "facilityId and rating (1-5) required" }, { status: 400 });
    }

    // Check user has completed a cart for this facility
    const completed = await sql`
      SELECT id FROM carts
      WHERE buyer_id = ${userId}
        AND facility_id = ${facilityId}
        AND status = 'completed'
      LIMIT 1
    `;
    if (completed.length === 0) {
      return Response.json({ error: "You must complete an order first" }, { status: 403 });
    }

    // Upsert review
    const result = await sql`
      INSERT INTO reviews (facility_id, user_id, rating, comment)
      VALUES (${facilityId}, ${userId}, ${rating}, ${comment || null})
      ON CONFLICT (facility_id, user_id)
      DO UPDATE SET rating = ${rating}, comment = ${comment || null}, created_at = CURRENT_TIMESTAMP
      RETURNING id, rating, comment, created_at
    `;

    // Update facility rating
    await sql`
      UPDATE facilities f
      SET rating = (
        SELECT ROUND(AVG(r.rating)::numeric, 1)
        FROM reviews r
        WHERE r.facility_id = ${facilityId}
      )
      WHERE f.id = ${facilityId}
    `;

    return Response.json({ review: result[0] });
  } catch (error) {
    console.error("Error creating review:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
