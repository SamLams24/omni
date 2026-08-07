export type MapFacilitySource = 'osm' | 'omni';

/**
 * Unified shape returned by GET /map/facilities, merging live OSM data
 * (always UNCONFIRMED -- OMNI never vouches for data it did not verify)
 * with OMNI-owned businesses (status computed from real KYC/subscription
 * state, see business-status.util.ts). No field here is ever fabricated:
 * anything OSM doesn't provide is null, never guessed.
 */
export type MapFacilityDto = {
  id: string;
  source: MapFacilitySource;
  businessId: string | null;
  name: string;
  category: string | null;
  subcategory: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  status: 'UNCONFIRMED' | 'CONFIRMED' | 'CERTIFIED';
  tags: Record<string, string>;
};
