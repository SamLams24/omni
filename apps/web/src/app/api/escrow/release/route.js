import sql from "@/app/api/utils/sql";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";

export async function POST(request) {
  try {
    const disabled = requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS");
    if (disabled) return disabled;

    const userId = request.headers.get("x-user-id");
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { cartId } = body;

    if (!cartId) return Response.json({ error: "cartId required" }, { status: 400 });

    const holds = await sql`
      SELECT eh.* FROM escrow_holds eh
      JOIN carts c ON c.id = eh.cart_id
      WHERE eh.cart_id = ${cartId} AND eh.status = 'held'
    `;
    if (holds.length === 0) return Response.json({ error: "No escrow hold found" }, { status: 404 });

    const hold = holds[0];

    // Release to vendor's wallet
    const vendorWallet = await sql`
      SELECT w.id FROM wallets w
      JOIN vendors v ON v.user_id = w.user_id
      WHERE v.id = ${hold.vendor_id}
    `;

    if (vendorWallet.length > 0) {
      await sql`UPDATE wallets SET balance = balance + ${hold.amount}, updated_at = CURRENT_TIMESTAMP WHERE id = ${vendorWallet[0].id}`;
      await sql`
        INSERT INTO transactions (wallet_id, type, amount, reference)
        VALUES (${vendorWallet[0].id}, 'escrow_release', ${hold.amount}, ${`Release for cart ${cartId}`})
      `;
    }

    await sql`UPDATE escrow_holds SET status = 'released', released_at = CURRENT_TIMESTAMP WHERE id = ${hold.id}`;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error releasing escrow:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
