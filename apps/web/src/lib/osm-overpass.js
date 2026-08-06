const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
// Must stay comfortably above the `[timeout:15]` declared inside the Overpass
// query itself -- aborting the client fetch before the server-declared budget
// elapses guarantees failures on a moderately loaded public instance.
const OVERPASS_QUERY_TIMEOUT_S = 15;
const OVERPASS_TIMEOUT_MS = (OVERPASS_QUERY_TIMEOUT_S + 5) * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const BUSINESS_AMENITIES = [
  "restaurant", "cafe", "fast_food", "bar", "pub", "pharmacy", "clinic",
  "doctors", "hospital", "dentist", "bank", "fuel", "marketplace",
  "bakery", "veterinary", "car_repair", "driving_school", "bureau_de_change",
];
const BUSINESS_TOURISM = ["hotel", "guest_house", "hostel", "apartment"];

const cache = new Map();

function cacheKey(bbox) {
  const round = (n) => Math.round(n * 200) / 200; // ~500m grid cells
  return [round(bbox.south), round(bbox.west), round(bbox.north), round(bbox.east)].join(",");
}

function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.elements;
}

function writeCache(key, elements) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { elements, storedAt: Date.now() });
}

export function boundingBoxFromRadius(lat, lon, radiusMeters) {
  const latDelta = radiusMeters / 111_320;
  const lonDelta = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180) || 1);
  return {
    south: lat - latDelta,
    north: lat + latDelta,
    west: lon - lonDelta,
    east: lon + lonDelta,
  };
}

function buildQuery(bbox) {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const amenityFilter = BUSINESS_AMENITIES.join("|");
  const tourismFilter = BUSINESS_TOURISM.join("|");
  return `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_S}];(
    node["shop"](${box});way["shop"](${box});
    node["amenity"~"^(${amenityFilter})$"](${box});way["amenity"~"^(${amenityFilter})$"](${box});
    node["office"](${box});way["office"](${box});
    node["craft"](${box});way["craft"](${box});
    node["healthcare"](${box});way["healthcare"](${box});
    node["tourism"~"^(${tourismFilter})$"](${box});way["tourism"~"^(${tourismFilter})$"](${box});
  );out center tags;`;
}

export class OsmOverpassError extends Error {
  constructor(message) {
    super(message);
    this.name = "OsmOverpassError";
  }
}

export async function queryOverpassBusinesses(bbox, { fetchImpl = fetch } = {}) {
  const key = cacheKey(bbox);
  const cached = readCache(key);
  if (cached) return cached;

  try {
    const response = await fetchImpl(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        // Overpass's usage policy asks for an identifying User-Agent;
        // some reverse proxies also deprioritize/reject generic clients.
        "User-Agent": "OmniApp/1.0 (+https://omni.app; discovery-map)",
      },
      body: buildQuery(bbox),
      signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new OsmOverpassError(`Overpass request failed with status ${response.status}`);
    }

    const data = await response.json();
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    writeCache(key, elements);
    return elements;
  } catch (error) {
    if (error instanceof OsmOverpassError) throw error;
    throw new OsmOverpassError(`Overpass request could not be completed: ${error?.message || error}`);
  }
}
