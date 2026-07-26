import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";
import { promoteNextAvailabilityGroup } from "@/domains/cart/queue";
import { buildCartResponse } from "@/domains/cart/response";

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { cartId, items, confirmAll } = body;
    if (!cartId) {
      return Response.json({ error: "cartId is required" }, { status: 400 });
    }

    const carts = await sql`
      SELECT
        c.id,
        c.status,
        c.buyer_id,
        c.payment_method,
        c.expires_at,
        f.vendor_id
      FROM carts c
      JOIN facilities f ON f.id = c.facility_id
      JOIN vendors v ON v.id = f.vendor_id
      WHERE c.id = ${cartId} AND v.user_id = ${user.id}
    `;
    if (carts.length === 0) {
      return Response.json({ error: "Cart not found or unauthorized" }, { status: 404 });
    }

    const cart = carts[0];
    if (cart.status !== "pending") {
      return Response.json({ error: "Cart has already been responded to" }, { status: 409 });
    }

    const cartRequests = await sql`
      SELECT
        ar.id, ar.status, ar.quantity_requested, ar.expires_at,
        COALESCE(ar.unit_price, p.price) AS price
      FROM availability_requests ar
      JOIN products p ON p.id = ar.product_id
      WHERE ar.cart_id = ${cartId}
      ORDER BY ar.created_at ASC
    `;

    const isExpired = new Date(cart.expires_at) <= new Date()
      || cartRequests.some(
        (item) => item.expires_at && new Date(item.expires_at) <= new Date(),
      );
    if (isExpired) {
      await sql`
        WITH expired_cart AS (
          UPDATE carts
          SET status = 'denied', responded_at = CURRENT_TIMESTAMP
          WHERE id = ${cartId} AND status = 'pending'
          RETURNING id
        ),
        cancelled_delivery AS (
          UPDATE delivery_requests
          SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
          WHERE cart_id IN (SELECT id FROM expired_cart)
            AND status = 'awaiting_confirmation'
          RETURNING id
        )
        UPDATE availability_requests
        SET status = 'denied', quantity_confirmed = NULL,
            responded_at = CURRENT_TIMESTAMP
        WHERE cart_id IN (SELECT id FROM expired_cart)
          AND status IN ('pending', 'queued')
      `;
      await promoteNextAvailabilityGroup(cart.vendor_id);
      return Response.json({ error: "Cart has expired" }, { status: 410 });
    }

    let responsePlan;
    try {
      responsePlan = buildCartResponse(cartRequests, { confirmAll, items });
    } catch (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const isEscrow = cart.payment_method === "escrow";
    if (isEscrow) {
      const disabled = requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS");
      if (disabled) return disabled;
    }

    const { responses, cartStatus, total, fee } = responsePlan;
    const requiresEscrowHold = isEscrow && cartStatus !== "denied";
    const amountToHold = total + fee;
    const responseJson = JSON.stringify(responses);

    const processed = await sql`
      WITH input AS (
        SELECT
          (item->>'request_id')::uuid AS request_id,
          item->>'status' AS status,
          NULLIF(item->>'quantity_confirmed', '')::integer AS quantity_confirmed
        FROM jsonb_array_elements(${responseJson}::jsonb) AS item
      ),
      transitioned AS (
        UPDATE carts c
        SET status = ${cartStatus}, responded_at = CURRENT_TIMESTAMP
        WHERE c.id = ${cartId}
          AND c.status = 'pending'
          AND c.expires_at > CURRENT_TIMESTAMP
          AND (
            SELECT COUNT(*) FROM availability_requests ar
            WHERE ar.cart_id = c.id AND ar.status = 'pending'
          ) = ${responses.length}
          AND NOT EXISTS (
            SELECT 1 FROM escrow_holds eh WHERE eh.cart_id = c.id
          )
          AND (
            ${!requiresEscrowHold}
            OR EXISTS (
              SELECT 1 FROM wallets w
              WHERE w.user_id = c.buyer_id AND w.balance >= ${amountToHold}
            )
          )
        RETURNING c.id
      ),
      updated_requests AS (
        UPDATE availability_requests ar
        SET status = input.status,
            quantity_confirmed = input.quantity_confirmed,
            responded_at = CURRENT_TIMESTAMP
        FROM input
        WHERE ar.id = input.request_id
          AND ar.cart_id = ${cartId}
          AND ar.status = 'pending'
          AND EXISTS (SELECT 1 FROM transitioned)
        RETURNING ar.id
      ),
      updated_delivery AS (
        UPDATE delivery_requests
        SET status = CASE
              WHEN ${cartStatus} = 'denied' THEN 'cancelled'
              ELSE 'looking'
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE cart_id = ${cartId}
          AND status = 'awaiting_confirmation'
          AND EXISTS (SELECT 1 FROM transitioned)
        RETURNING id
      ),
      debited AS (
        UPDATE wallets w
        SET balance = w.balance - ${amountToHold},
            updated_at = CURRENT_TIMESTAMP
        WHERE w.user_id = ${cart.buyer_id}
          AND ${requiresEscrowHold}
          AND w.balance >= ${amountToHold}
          AND (SELECT COUNT(*) FROM updated_requests) = ${responses.length}
        RETURNING w.id
      ),
      held AS (
        INSERT INTO escrow_holds (cart_id, buyer_id, vendor_id, amount, fee)
        SELECT ${cartId}, ${cart.buyer_id}, ${cart.vendor_id}, ${total}, ${fee}
        FROM debited
        RETURNING id
      ),
      hold_transaction AS (
        INSERT INTO transactions (wallet_id, type, amount, reference)
        SELECT id, 'escrow_hold', ${total}, ${`Hold for cart ${cartId}`}
        FROM debited
        RETURNING id
      ),
      fee_transaction AS (
        INSERT INTO transactions (wallet_id, type, amount, reference)
        SELECT id, 'fee', ${fee}, ${`Escrow fee 1% for cart ${cartId}`}
        FROM debited
        RETURNING id
      )
      SELECT
        transitioned.id,
        (SELECT COUNT(*) FROM updated_requests)::int AS updated_count,
        CASE
          WHEN ${requiresEscrowHold} THEN EXISTS (SELECT 1 FROM held)
          ELSE true
        END AS financial_complete
      FROM transitioned
    `;

    if (
      processed.length === 0
      || Number(processed[0].updated_count) !== responses.length
      || !processed[0].financial_complete
    ) {
      const wallet = requiresEscrowHold
        ? await sql`SELECT balance FROM wallets WHERE user_id = ${cart.buyer_id}`
        : [];
      if (requiresEscrowHold && Number(wallet[0]?.balance || 0) < amountToHold) {
        return Response.json(
          { error: "Insufficient balance", required: amountToHold },
          { status: 402 },
        );
      }
      return Response.json(
        { error: "Cart was already processed or changed" },
        { status: 409 },
      );
    }

    await promoteNextAvailabilityGroup(cart.vendor_id);
    await sql`
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        ${cart.buyer_id},
        'cart',
        'Réponse à votre panier',
        'Un vendeur a répondu à votre demande groupée',
        '/cart/history'
      )
    `;

    return Response.json({
      success: true,
      status: cartStatus,
      total,
      fee: requiresEscrowHold ? fee : 0,
    });
  } catch (error) {
    console.error("Error responding to cart:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
