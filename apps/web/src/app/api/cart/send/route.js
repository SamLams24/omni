import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireNonProductionFeature } from "@/app/api/utils/runtime-flags";

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const radiusKm = 6371;
  const toRadians = (value) => value * Math.PI / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat1))
    * Math.cos(toRadians(lat2))
    * Math.sin(deltaLon / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const body = await request.json();
    const { facilityId, items, note, paymentMethod, delivery, dropoffAddress, dropoffLat, dropoffLon } = body;
    const selectedPaymentMethod = paymentMethod || "cash";
    const wantsDelivery = delivery === true;

    if (!facilityId || !Array.isArray(items) || items.length === 0 || items.length > 50) {
      return Response.json(
        { error: "facilityId and items are required" },
        { status: 400 },
      );
    }
    if (!["cash", "escrow"].includes(selectedPaymentMethod)) {
      return Response.json({ error: "Invalid payment method" }, { status: 400 });
    }
    if (selectedPaymentMethod === "escrow") {
      const disabled = requireNonProductionFeature("ENABLE_MOCK_FINANCIAL_FLOWS");
      if (disabled) return disabled;
    }

    const productIds = new Set();
    const normalizedItems = [];
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (
        !item.productId
        || productIds.has(item.productId)
        || !Number.isInteger(quantity)
        || quantity < 1
        || quantity > 999
      ) {
        return Response.json(
          { error: "Cart items must have unique products and valid quantities" },
          { status: 400 },
        );
      }
      productIds.add(item.productId);
      normalizedItems.push({
        product_id: item.productId,
        quantity_requested: quantity,
      });
    }

    if (
      wantsDelivery
      && (
        dropoffLat == null
        || dropoffLon == null
        || dropoffLat === ""
        || dropoffLon === ""
        || !Number.isFinite(Number(dropoffLat))
        || !Number.isFinite(Number(dropoffLon))
        || Number(dropoffLat) < -90
        || Number(dropoffLat) > 90
        || Number(dropoffLon) < -180
        || Number(dropoffLon) > 180
      )
    ) {
      return Response.json(
        { error: "dropoffLat and dropoffLon are required for delivery" },
        { status: 400 },
      );
    }

    // Get facility and vendor info
    const facility = await sql`
      SELECT
        f.id,
        f.vendor_id,
        ST_Y(f.location::geometry) AS lat,
        ST_X(f.location::geometry) AS lon
      FROM facilities f
      WHERE f.id = ${facilityId}
    `;
    if (facility.length === 0) {
      return Response.json({ error: "Facility not found" }, { status: 404 });
    }

    const vendorId = facility[0].vendor_id;
    for (const item of normalizedItems) {
      const product = await sql`
        SELECT id, price
        FROM products
        WHERE id = ${item.product_id}
          AND facility_id = ${facilityId}
          AND vendor_id = ${vendorId}
          AND is_available = true
      `;
      if (product.length === 0) {
        return Response.json(
          { error: "A cart product is unavailable for this facility" },
          { status: 400 },
        );
      }
      item.unit_price = Number(product[0].price);
    }

    const pickupLat = wantsDelivery ? Number(facility[0].lat) : 0;
    const pickupLon = wantsDelivery ? Number(facility[0].lon) : 0;
    const dropLat = wantsDelivery ? Number(dropoffLat) : 0;
    const dropLon = wantsDelivery ? Number(dropoffLon) : 0;
    if (
      wantsDelivery
      && (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLon))
    ) {
      return Response.json(
        { error: "Facility location is unavailable" },
        { status: 409 },
      );
    }
    const deliveryFee = wantsDelivery
      ? Math.max(
          500,
          Math.round(
            calculateDistanceKm(pickupLat, pickupLon, dropLat, dropLon) * 100,
          ),
        )
      : 0;

    // Check vendor tier: escrow only for premium vendors
    if (selectedPaymentMethod === "escrow") {
      const vendorUser = await sql`
        SELECT vendor_tier FROM users WHERE id = (
          SELECT user_id FROM vendors WHERE id = ${vendorId}
        )
      `;
      if (vendorUser.length === 0 || vendorUser[0].vendor_tier !== "premium") {
        return Response.json(
          { error: "This vendor only accepts cash. Payment balance is not available on the free plan." },
          { status: 403 },
        );
      }
    }

    const itemsJson = JSON.stringify(normalizedItems);
    const created = await sql`
      WITH vendor_lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${vendorId}::text))
      ),
      queue_state AS (
        SELECT CASE
          WHEN COUNT(DISTINCT COALESCE(ar.cart_id::text, ar.id::text)) < 3
            THEN 'pending'
          ELSE 'queued'
        END AS initial_status
        FROM vendor_lock
        LEFT JOIN availability_requests ar
          ON ar.vendor_id = ${vendorId}
          AND ar.status = 'pending'
          AND ar.expires_at > CURRENT_TIMESTAMP
      ),
      input AS (
        SELECT
          (item->>'product_id')::uuid AS product_id,
          (item->>'quantity_requested')::integer AS quantity_requested,
          (item->>'unit_price')::numeric AS unit_price
        FROM jsonb_array_elements(${itemsJson}::jsonb) AS item
      ),
      created_cart AS (
        INSERT INTO carts (buyer_id, facility_id, note, payment_method)
        VALUES (${userId}, ${facilityId}, ${note || null}, ${selectedPaymentMethod})
        RETURNING id, created_at, expires_at
      ),
      created_requests AS (
        INSERT INTO availability_requests (
          buyer_id, vendor_id, facility_id, product_id,
          quantity_requested, unit_price, cart_id, status, expires_at
        )
        SELECT
          ${userId}, ${vendorId}, ${facilityId}, input.product_id,
          input.quantity_requested, input.unit_price,
          created_cart.id, queue_state.initial_status,
          created_cart.expires_at
        FROM input
        CROSS JOIN created_cart
        CROSS JOIN queue_state
        RETURNING id, product_id, quantity_requested, status, created_at, expires_at
      ),
      created_delivery AS (
        INSERT INTO delivery_requests (
          cart_id, buyer_id, facility_id, status,
          pickup_lat, pickup_lon, dropoff_lat, dropoff_lon,
          dropoff_address, delivery_fee
        )
        SELECT
          created_cart.id, ${userId}, ${facilityId}, 'awaiting_confirmation',
          ${pickupLat}, ${pickupLon}, ${dropLat}, ${dropLon},
          ${dropoffAddress || null}, ${deliveryFee}
        FROM created_cart
        WHERE ${wantsDelivery}
        RETURNING id
      )
      SELECT
        created_cart.id,
        created_cart.created_at,
        created_cart.expires_at,
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(created_requests)) FROM created_requests),
          '[]'::jsonb
        ) AS requests
      FROM created_cart
    `;
    const cartResult = created[0];
    const cartId = cartResult.id;
    const requests = cartResult.requests || [];

    // Notify vendor
    const vendorUser = await sql`
      SELECT user_id FROM vendors WHERE id = ${vendorId}
    `;
    if (vendorUser.length > 0) {
      const title = `Nouveau panier de ${items.length} articles`;
      await sql`
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (
          ${vendorUser[0].user_id}, 'cart', ${title},
          'Une demande groupée vous a été envoyée',
          '/vendor/requests'
        )
      `;
    }

    return Response.json({
      cartId,
      requests,
      expiresAt: cartResult.expires_at,
      success: true,
    });
  } catch (error) {
    console.error("Error sending cart:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
