import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    // Get delivery profile with active mode and radius
    const profiles = await sql`
      SELECT id, is_active, active_mode, active_radius_km,
        (SELECT delivery_tier FROM users WHERE id = ${userId}) as tier
      FROM delivery_profiles WHERE user_id = ${userId}
    `;
    if (profiles.length === 0 || !profiles[0].is_active) {
      return Response.json({ available: [] });
    }

    const p = profiles[0];
    const available = await sql`
      SELECT
        dr.id,
        dr.dropoff_address,
        dr.delivery_fee,
        f.name as facility_name,
        f.address as pickup_address,
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
        END as distance_km
      FROM delivery_requests dr
      JOIN facilities f ON f.id = dr.facility_id
      WHERE dr.status = 'looking'
        AND dr.buyer_id <> ${userId}
      ORDER BY dr.created_at ASC
      LIMIT 50
    `;

    return Response.json({
      available,
      mode: p.active_mode,
      radius_km: p.active_radius_km,
    });
  } catch (error) {
    console.error("Error fetching available deliveries:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
