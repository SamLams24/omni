import sql from "@/app/api/utils/sql";
import { getServerSession } from "@/lib/auth";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";

export async function POST(request) {
  try {
    let userId;
    const headerUserId = request.headers.get("x-user-id");
    if (headerUserId) {
      userId = headerUserId;
    } else {
      const session = await getServerSession(request);
      if (!session?.data?.user?.id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = session.data.user.id;
    }
    const body = await request.json();
    const { cartId, items, confirmAll } = body;

    if (!cartId) {
      return Response.json({ error: "cartId is required" }, { status: 400 });
    }

    // Verify vendor owns this cart's facility
    const cart = await sql`
      SELECT c.id, c.status, c.facility_id, c.payment_method FROM carts c
      JOIN facilities f ON f.id = c.facility_id
      JOIN vendors v ON v.id = f.vendor_id
      WHERE c.id = ${cartId} AND v.user_id = ${userId}
    `;
    if (cart.length === 0) {
      return Response.json({ error: "Cart not found or unauthorized" }, { status: 404 });
    }
    if (cart[0].status !== 'pending') {
      return Response.json({ error: "Cart has already been responded to" }, { status: 400 });
    }
    if (cart[0].payment_method === 'escrow') {
      const disabled = requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS");
      if (disabled) return disabled;
    }

    // Check expiration
    const cartRequests = await sql`
      SELECT id, expires_at FROM availability_requests
      WHERE cart_id = ${cartId} AND status = 'pending'
    `;

    for (const req of cartRequests) {
      if (req.expires_at && new Date(req.expires_at) < new Date()) {
        await sql`
          UPDATE availability_requests SET status = 'denied'
          WHERE id = ${req.id}
        `;
      }
    }

    if (confirmAll) {
      // Confirm all pending items with requested quantity
      await sql`
        UPDATE availability_requests
        SET status = 'confirmed', quantity_confirmed = quantity_requested, responded_at = CURRENT_TIMESTAMP
        WHERE cart_id = ${cartId} AND status = 'pending'
        RETURNING id
      `;
      await sql`
        UPDATE carts SET status = 'confirmed', responded_at = CURRENT_TIMESTAMP
        WHERE id = ${cartId}
      `;
    } else if (items && items.length > 0) {
      // Respond to specific items
      let allConfirmed = true;
      let allDenied = true;

      for (const item of items) {
        await sql`
          UPDATE availability_requests
          SET status = ${item.status}, quantity_confirmed = ${item.quantityConfirmed || null}, responded_at = CURRENT_TIMESTAMP
          WHERE id = ${item.requestId} AND cart_id = ${cartId}
        `;
        if (item.status === 'confirmed') allDenied = false;
        if (item.status === 'denied') allConfirmed = false;
      }

      // Update cart status based on responses
      if (allConfirmed) {
        await sql`UPDATE carts SET status = 'confirmed', responded_at = CURRENT_TIMESTAMP WHERE id = ${cartId}`;
      } else if (allDenied) {
        await sql`UPDATE carts SET status = 'denied', responded_at = CURRENT_TIMESTAMP WHERE id = ${cartId}`;
      } else {
        await sql`UPDATE carts SET status = 'partial', responded_at = CURRENT_TIMESTAMP WHERE id = ${cartId}`;
      }
    }

    // Escrow: if payment_method is 'escrow', hold the funds
    const recheck = await sql`SELECT status FROM carts WHERE id = ${cartId}`;
    const isConfirmed = recheck.length > 0 && recheck[0].status === 'confirmed';

    if (cart[0].payment_method === 'escrow' && isConfirmed) {
      const cartDetail = await sql`
        SELECT c.id, c.buyer_id, c.facility_id,
          SUM(p.price * ar.quantity_confirmed) as total
        FROM carts c
        JOIN availability_requests ar ON ar.cart_id = c.id
        JOIN products p ON p.id = ar.product_id
        WHERE c.id = ${cartId} AND ar.status = 'confirmed'
        GROUP BY c.id
      `;
      if (cartDetail.length > 0) {
        const total = parseFloat(cartDetail[0].total);
        const fee = Math.round(total * 0.01);
        const toHold = total + fee;

        const buyerWallet = await sql`SELECT id, balance FROM wallets WHERE user_id = ${cartDetail[0].buyer_id}`;
        if (buyerWallet.length > 0 && buyerWallet[0].balance >= toHold) {
          await sql`UPDATE wallets SET balance = balance - ${toHold}, updated_at = CURRENT_TIMESTAMP WHERE id = ${buyerWallet[0].id}`;
          await sql`
            INSERT INTO transactions (wallet_id, type, amount, reference)
            VALUES (${buyerWallet[0].id}, 'escrow_hold', ${toHold}, ${`Hold for cart ${cartId}`})
          `;
          await sql`
            INSERT INTO transactions (wallet_id, type, amount, reference)
            VALUES (${buyerWallet[0].id}, 'fee', ${fee}, ${`Escrow fee 1% for cart ${cartId}`})
          `;
          await sql`
            INSERT INTO escrow_holds (cart_id, buyer_id, vendor_id, amount, fee)
            VALUES (${cartId}, ${cartDetail[0].buyer_id}, ${cartDetail[0].facility_id}, ${total}, ${fee})
          `;
        }
      }
    }

    // Promote next queued requests for this facility's vendor
    const facilityVendorId = await sql`
      SELECT vendor_id FROM facilities WHERE id = ${cart[0].facility_id}
    `;
    if (facilityVendorId.length > 0) {
      await sql`
        UPDATE availability_requests
        SET status = 'pending'
        WHERE id = (
          SELECT id FROM availability_requests
          WHERE vendor_id = ${facilityVendorId[0].vendor_id}
            AND status = 'queued'
            AND expires_at > CURRENT_TIMESTAMP
          ORDER BY created_at ASC
          LIMIT 1
        )
      `;
    }

    // Notify buyer
    const buyerInfo = await sql`
      SELECT u.id FROM users u WHERE u.id = (SELECT buyer_id FROM carts WHERE id = ${cartId})
    `;
    if (buyerInfo.length > 0) {
      await sql`
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (${buyerInfo[0].id}, 'cart', 'Réponse à votre panier',
          'Un vendeur a répondu à votre demande groupée', '/cart/history')
      `;
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error responding to cart:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
