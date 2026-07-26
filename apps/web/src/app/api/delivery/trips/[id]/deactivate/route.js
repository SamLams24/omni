import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { id } = await params;
    const result = await sql`
      UPDATE delivery_planned_trips SET is_active = false
      WHERE id = ${id} AND delivery_profile_id = (
        SELECT id FROM delivery_profiles WHERE user_id = ${userId}
      )
      RETURNING id
    `;
    if (result.length === 0) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deactivating trip:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
