import type { MapFacilityDto } from './dto/map-facility.dto';

type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const CATEGORY_KEYS = [
  'shop',
  'amenity',
  'office',
  'craft',
  'healthcare',
  'tourism',
] as const;

// Never render an arbitrary OSM tag verbatim in the UI -- an attacker who
// controls OSM data (anyone can edit OSM) could otherwise inject content
// via unusual tag values. Only this small, curated set is ever forwarded.
const SAFE_TAG_KEYS = [
  'shop',
  'amenity',
  'office',
  'craft',
  'healthcare',
  'tourism',
  'name',
  'phone',
  'website',
  'opening_hours',
  'cuisine',
] as const;

function pickCategory(
  tags: Record<string, string>,
): { category: string; subcategory: string } | null {
  for (const key of CATEGORY_KEYS) {
    const value = tags[key];
    if (value) {
      return { category: key, subcategory: value };
    }
  }
  return null;
}

function buildAddress(tags: Record<string, string>): string | null {
  const parts = [tags['addr:street'], tags['addr:city']].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

function humanizeSubcategory(subcategory: string): string {
  return subcategory
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function sanitizeTags(tags: Record<string, string>): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const key of SAFE_TAG_KEYS) {
    const value = tags[key];
    if (typeof value === 'string' && value.length <= 200) {
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * Mirrors apps/web/src/app/api/discovery/osm/normalize.js (already clean
 * and tested) -- ported to TypeScript with the DTO shared by OMNI
 * businesses, plus the mission's explicit "always UNCONFIRMED" status.
 */
export function normalizeOsmElement(
  element: OsmElement,
): MapFacilityDto | null {
  const tags = element.tags ?? {};
  const picked = pickCategory(tags);
  if (!picked) {
    return null;
  }

  const lat = element.type === 'node' ? element.lat : element.center?.lat;
  const lon = element.type === 'node' ? element.lon : element.center?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return null;
  }

  return {
    id: `osm:${element.type}:${element.id}`,
    source: 'osm',
    businessId: null,
    name:
      tags.name ?? `${humanizeSubcategory(picked.subcategory)} (OpenStreetMap)`,
    category: picked.category,
    subcategory: picked.subcategory,
    latitude: lat,
    longitude: lon,
    address: buildAddress(tags),
    phone: tags.phone ?? tags['contact:phone'] ?? null,
    website: tags.website ?? tags['contact:website'] ?? null,
    openingHours: tags.opening_hours ?? null,
    status: 'UNCONFIRMED',
    tags: sanitizeTags(tags),
  };
}
