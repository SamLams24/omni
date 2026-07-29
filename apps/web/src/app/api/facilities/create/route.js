import sql from "@/app/api/utils/sql";
import {
  CatalogInputError,
  parseFacilityCreationInput,
  readCatalogRequest,
} from "@/domains/catalog/input";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const {
      vendorId,
      name,
      category,
      type,
      description,
      lat,
      lon,
      address,
      neighborhood,
    } = await readCatalogRequest(request, parseFacilityCreationInput);

    // Verify vendor ownership
    const vendor = await sql`
      SELECT id, user_id FROM vendors WHERE id = ${vendorId} AND user_id = ${userId}
    `;
    if (vendor.length === 0) {
      return Response.json({ error: "Vendor not found or unauthorized" }, { status: 404 });
    }

    // Check subscription limit: free vendors can have only 1 facility
    const userTier = await sql`
      SELECT vendor_tier FROM users WHERE id = ${userId}
    `;
    const isFree = userTier.length === 0 || userTier[0].vendor_tier === 'free';

    if (isFree) {
      const facilityCount = await sql`
        SELECT COUNT(*) as cnt FROM facilities WHERE vendor_id = ${vendorId}
      `;
      if (parseInt(facilityCount[0].cnt) >= 1) {
        return Response.json(
          { error: "Free vendors can only have 1 facility. Subscribe to add more." },
          { status: 403 },
        );
      }
    }

    const result = await sql`
      INSERT INTO facilities (vendor_id, name, category, type, description, location, address, neighborhood)
      VALUES (
        ${vendorId}, ${name}, ${category}, ${type}, ${description},
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326),
        ${address}, ${neighborhood}
      )
      RETURNING id
    `;

    return Response.json({ facilityId: result[0].id, success: true });
  } catch (error) {
    if (error instanceof CatalogInputError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating facility:", error);
    return Response.json(
      { error: "Failed to create facility" },
      { status: 500 },
    );
  }
}
