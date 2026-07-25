import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const deliveries = await sql`
      SELECT dr.id, dr.cart_id, dr.status, dr.dropoff_address, dr.delivery_fee,
        CASE
          WHEN dr.pickup_lat IS NOT NULL
            AND dr.pickup_lon IS NOT NULL
            AND dr.dropoff_lat IS NOT NULL
            AND dr.dropoff_lon IS NOT NULL
          THEN ROUND((
            ST_DistanceSphere(
              ST_MakePoint(dr.pickup_lon, dr.pickup_lat),
              ST_MakePoint(dr.dropoff_lon, dr.dropoff_lat)
            ) / 1000
          )::numeric, 1)
          ELSE NULL
        END as distance_km,
        dr.created_at,
        f.name as facility_name, f.category as facility_category
      FROM delivery_requests dr
      JOIN facilities f ON f.id = dr.facility_id
      WHERE dr.delivery_profile_id = (
        SELECT id FROM delivery_profiles WHERE user_id = ${userId}
      ) AND dr.status IN ('matched', 'picked_up', 'in_transit')
      ORDER BY dr.created_at DESC
    `;

    return Response.json({ deliveries });
  } catch (error) {
    console.error("Error fetching active deliveries:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
