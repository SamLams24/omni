import sql from "@/app/api/utils/sql";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";

export async function POST(request) {
  try {
    const disabled = requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS");
    if (disabled) return disabled;

    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { requestId } = body;
    if (!requestId) {
      return Response.json({ error: "requestId is required" }, { status: 400 });
    }

    // Verify delivery person owns this request and it's in a valid status
    const deliveryReqs = await sql`
      SELECT dr.id, dr.cart_id, dr.status, dr.delivery_fee, dr.buyer_id, dr.facility_id,
        c.payment_method, c.status as cart_status
      FROM delivery_requests dr
      JOIN carts c ON c.id = dr.cart_id
      WHERE dr.id = ${requestId} AND dr.delivery_profile_id = (
        SELECT id FROM delivery_profiles WHERE user_id = ${userId}
      )
    `;
    if (deliveryReqs.length === 0) {
      return Response.json({ error: "Delivery request not found or unauthorized" }, { status: 404 });
    }

    const req = deliveryReqs[0];
    if (!["matched", "picked_up", "in_transit"].includes(req.status)) {
      return Response.json({ error: `Cannot confirm delivery: status is '${req.status}'` }, { status: 400 });
    }

    // Update delivery_request to delivered
    await sql`
      UPDATE delivery_requests SET status = 'delivered', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${requestId}
    `;

    // Pay delivery person
    const deliveryFee = parseFloat(req.delivery_fee) || 500;
    const profileWallets = await sql`
      SELECT w.id FROM wallets w
      JOIN delivery_profiles dp ON dp.user_id = w.user_id
      WHERE dp.user_id = ${userId}
    `;
    if (profileWallets.length > 0) {
      await sql`
        UPDATE wallets SET balance = balance + ${deliveryFee}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${profileWallets[0].id}
      `;
      await sql`
        INSERT INTO transactions (wallet_id, type, amount, reference)
        VALUES (${profileWallets[0].id}, 'delivery_payment', ${deliveryFee}, ${`Paiement livraison #${requestId}`})
      `;
    }

    // Handle payment method
    if (req.payment_method === 'cash') {
      await sql`
        UPDATE carts SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ${req.cart_id}
      `;
    } else if (req.payment_method === 'escrow') {
      await sql`
        UPDATE escrow_holds SET delivery_confirmed_at = CURRENT_TIMESTAMP
        WHERE cart_id = ${req.cart_id} AND released_at IS NULL AND refunded_at IS NULL
      `;
    }

    // Notify buyer
    await sql`
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (${req.buyer_id}, 'delivery', 'Livraison confirmée',
        'Votre colis a été livré', '/cart/history')
    `;

    return Response.json({ success: true, deliveryFee });
  } catch (error) {
    console.error("Error confirming delivery:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
