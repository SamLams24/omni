const CATEGORY_KEYS = ["shop", "amenity", "office", "craft", "healthcare", "tourism"];

const SAFE_TAG_KEYS = new Set([
  "shop", "amenity", "office", "craft", "healthcare", "tourism",
  "name", "phone", "website", "opening_hours", "cuisine",
]);

function pickCategory(tags) {
  for (const key of CATEGORY_KEYS) {
    if (tags[key]) return { category: key, subcategory: tags[key] };
  }
  return null;
}

function buildAddress(tags) {
  const parts = [tags["addr:street"], tags["addr:city"]].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function humanizeSubcategory(subcategory) {
  return subcategory
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function sanitizeTags(tags) {
  const safe = {};
  for (const key of SAFE_TAG_KEYS) {
    if (typeof tags[key] === "string" && tags[key].length <= 200) {
      safe[key] = tags[key];
    }
  }
  return safe;
}

export function normalizeOsmElement(element) {
  const tags = element?.tags || {};
  const picked = pickCategory(tags);
  if (!picked) return null;

  const lat = element.type === "node" ? element.lat : element.center?.lat;
  const lon = element.type === "node" ? element.lon : element.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return null;

  return {
    id: `osm:${element.type}:${element.id}`,
    osmType: element.type,
    osmId: element.id,
    source: "osm",
    name: tags.name || `${humanizeSubcategory(picked.subcategory)} (OpenStreetMap)`,
    category: picked.category,
    subcategory: picked.subcategory,
    lat,
    lon,
    address: buildAddress(tags),
    phone: tags.phone || tags["contact:phone"] || null,
    website: tags.website || tags["contact:website"] || null,
    opening_hours: tags.opening_hours || null,
    verification_status: "non_verifiee",
    tags: sanitizeTags(tags),
  };
}
