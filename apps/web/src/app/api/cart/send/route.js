import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

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

    if (!facilityId || !items || items.length === 0) {
      return Response.json(
        { error: "facilityId and items are required" },
        { status: 400 },
      );
    }
    if (
      delivery
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
      SELECT f.id, f.vendor_id FROM facilities f WHERE f.id = ${facilityId}
    `;
    if (facility.length === 0) {
      return Response.json({ error: "Facility not found" }, { status: 404 });
    }

    const vendorId = facility[0].vendor_id;

    // Check vendor tier: escrow only for premium vendors
    if (paymentMethod === 'escrow') {
      const vendorUser = await sql`
        SELECT vendor_tier FROM users WHERE id = (
          SELECT user_id FROM vendors WHERE id = ${vendorId}
        )
      `;
      if (vendorUser.length > 0 && vendorUser[0].vendor_tier === 'free') {
        return Response.json(
          { error: "This vendor only accepts cash. Payment balance is not available on the free plan." },
          { status: 403 },
        );
      }
    }

    // Create the cart
    const cartResult = await sql`
      INSERT INTO carts (buyer_id, facility_id, note, payment_method)
      VALUES (${userId}, ${facilityId}, ${note || null}, ${paymentMethod || 'cash'})
      RETURNING id, created_at, expires_at
    `;
    const cartId = cartResult[0].id;

    // Create availability requests for each item
    const requests = [];
    for (const item of items) {
      const result = await sql`
        INSERT INTO availability_requests (buyer_id, vendor_id, facility_id, product_id, quantity_requested, cart_id, status, expires_at)
        VALUES (${userId}, ${vendorId}, ${facilityId}, ${item.productId}, ${item.quantity}, ${cartId}, 'queued', CURRENT_TIMESTAMP + INTERVAL '5 minutes')
        RETURNING id, product_id, quantity_requested, status, created_at, expires_at
      `;

      // Auto-promote to pending if vendor has < 3 active
      const activeCount = await sql`
        SELECT COUNT(*) as cnt FROM availability_requests
        WHERE vendor_id = ${vendorId} AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP
      `;
      if (parseInt(activeCount[0].cnt) < 3) {
        await sql`
          UPDATE availability_requests SET status = 'pending'
          WHERE id = ${result[0].id}
        `;
        result[0].status = 'pending';
      }

      requests.push(result[0]);
    }

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

    // Create delivery request if requested
    if (delivery) {
      const facilityLoc = await sql`
        SELECT
          ST_Y(location::geometry) as lat,
          ST_X(location::geometry) as lon
        FROM facilities
        WHERE id = ${facilityId}
      `;
      const pickupLat = Number(facilityLoc[0]?.lat);
      const pickupLon = Number(facilityLoc[0]?.lon);
      const dropLat = Number(dropoffLat);
      const dropLon = Number(dropoffLon);
      if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLon)) {
        return Response.json(
          { error: "Facility location is unavailable" },
          { status: 409 },
        );
      }
      const distKm = calculateDistanceKm(pickupLat, pickupLon, dropLat, dropLon);
      const deliveryFee = Math.max(500, Math.round(distKm * 100));

      await sql`
        INSERT INTO delivery_requests (
          cart_id, buyer_id, facility_id, status,
          pickup_lat, pickup_lon, dropoff_lat, dropoff_lon,
          dropoff_address, delivery_fee
        )
        VALUES (
          ${cartId}, ${userId}, ${facilityId}, 'looking',
          ${pickupLat}, ${pickupLon}, ${dropLat}, ${dropLon},
          ${dropoffAddress || null}, ${deliveryFee}
        )
      `;
    }

    return Response.json({
      cartId,
      requests,
      expiresAt: cartResult[0].expires_at,
      success: true,
    });
  } catch (error) {
    console.error("Error sending cart:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
