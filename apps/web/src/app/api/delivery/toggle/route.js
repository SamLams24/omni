import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const profile = await sql`
      SELECT id, is_active, daily_delivery_count, last_delivery_date,
        (SELECT delivery_tier FROM users WHERE id = ${userId}) as tier
      FROM delivery_profiles WHERE user_id = ${userId}
    `;
    if (profile.length === 0) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    const p = profile[0];
    const today = new Date().toISOString().split("T")[0];

    // Reset daily count if new day
    let dailyCount = p.daily_delivery_count;
    if (p.last_delivery_date !== today) {
      dailyCount = 0;
    }

    // If activating, check free tier limit
    const isFree = p.tier === 'free' || !p.tier;
    const newIsActive = !p.is_active;

    if (newIsActive && isFree && dailyCount >= 3) {
      return Response.json({
        error: "Limite quotidienne atteinte (3/jour). Abonne-toi pour livrer sans limite (1 000 FCFA/mois).",
      }, { status: 403 });
    }

    await sql`
      UPDATE delivery_profiles
      SET is_active = ${newIsActive},
          daily_delivery_count = ${dailyCount},
          last_delivery_date = ${today},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${p.id}
    `;

    return Response.json({
      success: true,
      is_active: newIsActive,
      daily_delivery_count: dailyCount,
    });
  } catch (error) {
    console.error("Error toggling delivery profile:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
