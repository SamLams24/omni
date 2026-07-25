import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const profile = await sql`
      SELECT id FROM delivery_profiles WHERE user_id = ${userId}
    `;
    if (profile.length === 0) {
      return Response.json({ deliveries: [] });
    }

    const deliveries = await sql`
      SELECT dr.*, f.name as facility_name,
        u.name as buyer_name
      FROM delivery_requests dr
      LEFT JOIN facilities f ON f.id = dr.facility_id
      LEFT JOIN users u ON u.id = dr.buyer_id
      WHERE dr.delivery_profile_id = ${profile[0].id}
        AND dr.status IN ('delivered', 'cancelled')
      ORDER BY dr.updated_at DESC
      LIMIT 50
    `;

    return Response.json({ deliveries });
  } catch (error) {
    console.error("Error fetching delivery history:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
