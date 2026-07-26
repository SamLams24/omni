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

    // Verify cart belongs to user and is confirmed/partial
    const cart = await sql`
      SELECT id, status, buyer_id FROM carts WHERE id = ${id}
    `;
    if (cart.length === 0) {
      return Response.json({ error: "Cart not found" }, { status: 404 });
    }
    if (cart[0].buyer_id !== userId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (cart[0].status !== 'confirmed' && cart[0].status !== 'partial') {
      return Response.json({ error: "Cart cannot be marked as received" }, { status: 400 });
    }

    // Release escrow to vendor
    const escrowHold = await sql`
      SELECT id, vendor_id, amount, fee FROM escrow_holds
      WHERE cart_id = ${id} AND status = 'held'
    `;
    if (escrowHold.length > 0) {
      const disabled = requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS");
      if (disabled) return disabled;
    }

    await sql`
      UPDATE carts SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    if (escrowHold.length > 0) {
      const vendorId = escrowHold[0].vendor_id;
      const netAmount = parseFloat(escrowHold[0].amount);
      const vendorUser = await sql`
        SELECT user_id FROM vendors WHERE id = ${vendorId}
      `;
      if (vendorUser.length > 0) {
        const vendorWallet = await sql`
          SELECT id FROM wallets WHERE user_id = ${vendorUser[0].user_id}
        `;
        if (vendorWallet.length > 0) {
          await sql`
            UPDATE wallets SET balance = balance + ${netAmount}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${vendorWallet[0].id}
          `;
          await sql`
            INSERT INTO transactions (wallet_id, type, amount, reference)
            VALUES (${vendorWallet[0].id}, 'escrow_release', ${netAmount}, ${`Released for cart ${id}`})
          `;
          await sql`
            UPDATE escrow_holds
            SET status = 'released', released_at = CURRENT_TIMESTAMP
            WHERE id = ${escrowHold[0].id} AND status = 'held'
          `;
        }
      }
    }

    // Notify vendor
    const vendorInfo = await sql`
      SELECT v.user_id FROM carts c
      JOIN facilities f ON f.id = c.facility_id
      JOIN vendors v ON v.id = f.vendor_id
      WHERE c.id = ${id}
    `;
    if (vendorInfo.length > 0) {
      await sql`
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (${vendorInfo[0].user_id}, 'order',
          'Commande marquée reçue',
          'L\'acheteur a confirmé la réception',
          '/vendor/dashboard')
      `;
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error marking received:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
