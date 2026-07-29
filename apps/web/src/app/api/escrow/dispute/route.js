import sql from "@/app/api/utils/sql";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(request) {
  try {
    const disabled = requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS");
    if (disabled) return disabled;

    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    const body = await request.json();
    const { cartId } = body;
    if (!cartId) {
      return Response.json({ error: "cartId required" }, { status: 400 });
    }

    const escrow = await sql`
      UPDATE escrow_holds eh
      SET status = 'disputed'
      FROM carts c
      JOIN facilities f ON f.id = c.facility_id
      JOIN vendors v ON v.id = f.vendor_id
      WHERE eh.cart_id = c.id
        AND eh.cart_id = ${cartId}
        AND eh.status = 'held'
        AND (c.buyer_id = ${userId} OR v.user_id = ${userId})
      RETURNING eh.*
    `;

    if (escrow.length === 0) {
      return Response.json({ error: "No active escrow for this cart" }, { status: 404 });
    }

    return Response.json({ escrow: escrow[0], message: "Litige ouvert. Les fonds sont bloqués en attendant la résolution." });
  } catch (error) {
    console.error("Error opening dispute:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
