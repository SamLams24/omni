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
    const { vendorId, facilityId, productId, quantity } = body;

    if (!vendorId || !productId || !quantity) {
      return Response.json(
        { error: "Missing required fields: vendorId, productId, quantity" },
        { status: 400 },
      );
    }

    const buyerId = userId;

    // Verify vendor exists
    const vendorCheck = await sql`
      SELECT id FROM vendors WHERE id = ${vendorId}
    `;
    
    if (vendorCheck.length === 0) {
      return Response.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Get vendor user_id for notification
    const vendor = await sql`
      SELECT v.user_id FROM vendors v WHERE v.id = ${vendorId}
    `;

    // Resolve facility_id from product if not provided
    let resolvedFacilityId = facilityId;
    if (!resolvedFacilityId) {
      const prod = await sql`
        SELECT facility_id FROM products WHERE id = ${productId}
      `;
      if (prod.length > 0) resolvedFacilityId = prod[0].facility_id;
    }

    // Create request with 5-minute expiry, initially queued
    const result = await sql`
      INSERT INTO availability_requests (buyer_id, vendor_id, facility_id, product_id, quantity_requested, status, expires_at)
      VALUES (${buyerId}, ${vendorId}, ${resolvedFacilityId}, ${productId}, ${quantity}, 'queued', CURRENT_TIMESTAMP + INTERVAL '5 minutes')
      RETURNING id, buyer_id, vendor_id, facility_id, product_id, quantity_requested, status, created_at, expires_at
    `;

    // Try to promote: if vendor has < 3 pending, this becomes pending
    const activeCount = await sql`
      SELECT COUNT(*) as cnt FROM availability_requests
      WHERE vendor_id = ${vendorId} AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP
    `;
    const isPending = parseInt(activeCount[0].cnt) < 3;

    if (isPending) {
      await sql`
        UPDATE availability_requests SET status = 'pending'
        WHERE id = ${result[0].id}
      `;
      result[0].status = 'pending';

      // Notify vendor
      if (vendor.length > 0) {
        await sql`
          INSERT INTO notifications (user_id, type, title, message, link)
          VALUES (
            ${vendor[0].user_id},
            'request',
            'Nouvelle demande',
            ${`Quelqu'un demande: ${quantity} articles`},
            '/vendor/requests'
          )
        `;
      }
    }

    return Response.json({ request: result[0], success: true });
  } catch (error) {
    console.error("Error creating availability request:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
