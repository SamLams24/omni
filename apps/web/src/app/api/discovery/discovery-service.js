import sql from "@/app/api/utils/sql";
import { escapeLikePattern, normalizeGeoRow } from "./geo";

const facilityFields = `
  f.id,
  f.name AS facility_name,
  f.category,
  f.description,
  f.type,
  f.is_online,
  f.rating,
  ST_Y(f.location::geometry) AS lat,
  ST_X(f.location::geometry) AS lon,
  ST_Distance(
    f.location,
    ST_SetSRID(ST_Point($1, $2), 4326)::geography
  ) AS distance,
  v.id AS vendor_id,
  v.name AS vendor_name,
  COUNT(p.id) FILTER (WHERE p.is_available = true) AS product_count,
  COALESCE(
    AVG(p.price) FILTER (WHERE p.is_available = true),
    0
  ) AS avg_price,
  (
    SELECT COUNT(*)
    FROM reviews r
    WHERE r.facility_id = f.id
  ) AS review_count,
  v.kyc_status,
  (v.user_id IS NOT NULL) AS claimed,
  EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.user_id = v.user_id
      AND s.type = 'vendor'
      AND s.status = 'active'
      AND (s.end_date IS NULL OR s.end_date > CURRENT_TIMESTAMP)
  ) AS subscription_active
`;

const facilityJoins = `
  FROM facilities f
  JOIN vendors v ON v.id = f.vendor_id
  LEFT JOIN products p ON p.facility_id = f.id
`;

const facilityAvailability = `
  f.is_online = true
  AND v.is_online = true
  AND v.is_available = true
`;

const facilityGroup = `
  GROUP BY
    f.id, f.name, f.category, f.description, f.type,
    f.is_online, f.rating, f.location, v.id, v.name, v.kyc_status, v.user_id
`;

export async function findNearbyFacilities({ lat, lon, radius, limit }) {
  const query = `
    SELECT ${facilityFields}
    ${facilityJoins}
    WHERE ${facilityAvailability}
      AND ST_DWithin(
        f.location,
        ST_SetSRID(ST_Point($1, $2), 4326)::geography,
        $3
      )
    ${facilityGroup}
    ORDER BY distance ASC, f.id ASC
    LIMIT $4
  `;
  const rows = await sql(query, [lon, lat, radius, limit]);
  return rows.map(normalizeGeoRow);
}

export async function searchNearbyFacilities({
  lat,
  lon,
  radius,
  limit,
  search,
}) {
  const query = `
    SELECT ${facilityFields}
    ${facilityJoins}
    WHERE ${facilityAvailability}
      AND ST_DWithin(
        f.location,
        ST_SetSRID(ST_Point($1, $2), 4326)::geography,
        $3
      )
      AND (
        f.name ILIKE $4
        OR f.category ILIKE $4
        OR COALESCE(f.description, '') ILIKE $4
        OR v.name ILIKE $4
        OR EXISTS (
          SELECT 1
          FROM products matching_product
          WHERE matching_product.facility_id = f.id
            AND matching_product.is_available = true
            AND matching_product.name ILIKE $4
        )
      )
    ${facilityGroup}
    ORDER BY distance ASC, f.id ASC
    LIMIT $5
  `;
  const pattern = `%${escapeLikePattern(search)}%`;
  const rows = await sql(query, [lon, lat, radius, pattern, limit]);
  return rows.map(normalizeGeoRow);
}

export async function findNearbyVendors({ lat, lon, radius, limit }) {
  const query = `
    SELECT
      v.id,
      v.name,
      v.category,
      v.description,
      v.rating,
      ST_Y(v.location::geometry) AS lat,
      ST_X(v.location::geometry) AS lon,
      ST_Distance(
        v.location,
        ST_SetSRID(ST_Point($1, $2), 4326)::geography
      ) AS distance,
      COUNT(p.id) FILTER (WHERE p.is_available = true) AS product_count,
      COALESCE(
        AVG(p.price) FILTER (WHERE p.is_available = true),
        0
      ) AS avg_price
    FROM vendors v
    LEFT JOIN products p ON p.vendor_id = v.id
    WHERE v.is_online = true
      AND v.is_available = true
      AND ST_DWithin(
        v.location,
        ST_SetSRID(ST_Point($1, $2), 4326)::geography,
        $3
      )
    GROUP BY
      v.id, v.name, v.category, v.description,
      v.rating, v.location
    ORDER BY distance ASC, v.id ASC
    LIMIT $4
  `;
  const rows = await sql(query, [lon, lat, radius, limit]);
  return rows.map(normalizeGeoRow);
}
