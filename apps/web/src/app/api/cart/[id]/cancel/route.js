import sql from "@/app/api/utils/sql";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { id } = await params;
    if (!id) {
      return Response.json({ error: "Cart ID required" }, { status: 400 });
    }

    const cart = await sql`
      SELECT id, status, buyer_id FROM carts WHERE id = ${id}
    `;
    if (cart.length === 0) {
      return Response.json({ error: "Cart not found" }, { status: 404 });
    }
    if (cart[0].buyer_id !== userId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (cart[0].status === 'completed' || cart[0].status === 'cancelled') {
      return Response.json({ error: "Cart already finalized" }, { status: 400 });
    }

    // Refund escrow if held
    const escrowHold = await sql`
      SELECT id, buyer_id, amount, fee FROM escrow_holds
      WHERE cart_id = ${id} AND status = 'held'
    `;
    if (escrowHold.length > 0) {
      const disabled = requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS");
      if (disabled) return disabled;
    }

    await sql`UPDATE carts SET status = 'cancelled' WHERE id = ${id}`;

    if (escrowHold.length > 0) {
      const refundAmount = parseFloat(escrowHold[0].amount) + parseFloat(escrowHold[0].fee);
      const buyerWallet = await sql`
        SELECT id FROM wallets WHERE user_id = ${escrowHold[0].buyer_id}
      `;
      if (buyerWallet.length > 0) {
        await sql`
          UPDATE wallets SET balance = balance + ${refundAmount}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${buyerWallet[0].id}
        `;
        await sql`
          INSERT INTO transactions (wallet_id, type, amount, reference)
          VALUES (${buyerWallet[0].id}, 'escrow_refund', ${refundAmount}, ${`Refund for cancelled cart ${id}`})
        `;
        await sql`
          UPDATE escrow_holds SET status = 'refunded', released_at = CURRENT_TIMESTAMP WHERE id = ${escrowHold[0].id}
        `;
      }
    }

    // Release pending requests back to queue
    await sql`
      UPDATE availability_requests SET status = 'denied'
      WHERE cart_id = ${id} AND status = 'pending'
    `;

    // Promote next queued requests
    const facilityVendor = await sql`
      SELECT f.vendor_id FROM carts c
      JOIN facilities f ON f.id = c.facility_id
      WHERE c.id = ${id}
    `;
    if (facilityVendor.length > 0) {
      await sql`
        UPDATE availability_requests
        SET status = 'pending'
        WHERE id = (
          SELECT id FROM availability_requests
          WHERE vendor_id = ${facilityVendor[0].vendor_id}
            AND status = 'queued'
            AND expires_at > CURRENT_TIMESTAMP
          ORDER BY created_at ASC
          LIMIT 1
        )
      `;
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error cancelling cart:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
