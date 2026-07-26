import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    const users = await sql`
      SELECT vendor_tier, delivery_tier FROM users WHERE id = ${userId}
    `;

    if (users.length === 0) return Response.json({ vendorTier: "free", deliveryTier: "free" });

    return Response.json({
      vendorTier: users[0].vendor_tier || "free",
      deliveryTier: users[0].delivery_tier || "free",
    });
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
