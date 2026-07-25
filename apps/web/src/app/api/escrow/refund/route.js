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
      WHERE eh.cart_id = ${cartId} AND eh.status = 'held'
    `;
    if (holds.length === 0) return Response.json({ error: "No escrow hold found" }, { status: 404 });

    const hold = holds[0];

    // Refund to buyer's wallet
    await sql`UPDATE wallets SET balance = balance + ${hold.amount}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ${hold.buyer_id}`;
    const buyerWallet = await sql`SELECT id FROM wallets WHERE user_id = ${hold.buyer_id}`;
    if (buyerWallet.length > 0) {
      await sql`
        INSERT INTO transactions (wallet_id, type, amount, reference)
        VALUES (${buyerWallet[0].id}, 'escrow_refund', ${hold.amount}, ${`Refund for cart ${cartId}`})
      `;
    }

    await sql`UPDATE escrow_holds SET status = 'refunded', released_at = CURRENT_TIMESTAMP WHERE id = ${hold.id}`;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error refunding escrow:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
