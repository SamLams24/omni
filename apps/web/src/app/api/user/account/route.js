import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function DELETE(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    // CASCADE: vendors → products, favorites, availability_requests, messages
    await sql`DELETE FROM users WHERE id = ${userId}`;

    return Response.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/user/account error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
