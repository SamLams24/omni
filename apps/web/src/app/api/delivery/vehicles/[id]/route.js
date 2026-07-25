import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function DELETE(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const vehicleId = params.id;

    const vehicles = await sql`
      SELECT dv.id FROM delivery_vehicles dv
      JOIN delivery_profiles dp ON dp.id = dv.delivery_profile_id
      WHERE dv.id = ${vehicleId} AND dp.user_id = ${userId}
    `;
    if (vehicles.length === 0) {
      return Response.json({ error: "Vehicle not found" }, { status: 404 });
    }

    await sql`DELETE FROM delivery_vehicles WHERE id = ${vehicleId}`;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting vehicle:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
