import sql from "@/app/api/utils/sql";

export async function promoteNextAvailabilityGroup(vendorId) {
  await sql`
    WITH next_group AS (
      SELECT id, cart_id
      FROM availability_requests
      WHERE vendor_id = ${vendorId}
        AND status = 'queued'
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at ASC
      LIMIT 1
    )
    UPDATE availability_requests ar
    SET status = 'pending'
    FROM next_group ng
    WHERE
      (ng.cart_id IS NOT NULL AND ar.cart_id = ng.cart_id)
      OR (ng.cart_id IS NULL AND ar.id = ng.id)
  `;
}
