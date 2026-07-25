import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";

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

    // Get facility and vendor info
    const facility = await sql`
      SELECT f.id, f.vendor_id, f.vendor_id FROM facilities f WHERE f.id = ${facilityId}
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
        SELECT ST_AsText(location) as wkt FROM facilities WHERE id = ${facilityId}
      `;
      const wkt = facilityLoc[0]?.wkt || "POINT(1.2228 6.1319)";
      const m = wkt.match(/POINT\(([\d.-]+) ([\d.-]+)\)/i);
      const pickupLon = m ? parseFloat(m[1]) : 1.2228;
      const pickupLat = m ? parseFloat(m[2]) : 6.1319;

      // Calculate delivery fee based on distance (mock: 500 + distance_km * 100)
      const distKm = 1.0; // simplified for now
      const deliveryFee = Math.max(500, Math.round(distKm * 100));
      const dropLon = dropoffLon || 1.2228;
      const dropLat = dropoffLat || 6.1319;

      await sql`
        INSERT INTO delivery_requests (cart_id, buyer_id, vendor_id, facility_id, status,
          pickup_location, dropoff_location, dropoff_address, distance_km, delivery_fee)
        VALUES (${cartId}, ${userId}, ${vendorId}, ${facilityId}, 'looking',
          ST_SetSRID(ST_MakePoint(${pickupLon}, ${pickupLat}), 4326),
          ST_SetSRID(ST_MakePoint(${dropLon}, ${dropLat}), 4326),
          ${dropoffAddress || null}, ${distKm}, ${deliveryFee})
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
