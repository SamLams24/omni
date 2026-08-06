import { GeoValidationError, parseNearbyParams, MAX_NEARBY_RADIUS_METERS } from "@/app/api/discovery/geo";
import { boundingBoxFromRadius, queryOverpassBusinesses, OsmOverpassError } from "@/lib/osm-overpass";
import { normalizeOsmElement } from "./normalize";

const OSM_MAX_RADIUS_METERS = Math.min(3000, MAX_NEARBY_RADIUS_METERS);

async function readParams(request) {
  if (request.method === "GET") {
    return parseNearbyParams(new URL(request.url).searchParams, { defaultRadius: 1500 });
  }
  return parseNearbyParams(await request.json(), { defaultRadius: 1500 });
}

export async function handleOsmNearby(request) {
  try {
    const params = await readParams(request);
    const radius = Math.min(params.radius, OSM_MAX_RADIUS_METERS);
    const bbox = boundingBoxFromRadius(params.lat, params.lon, radius);
    const elements = await queryOverpassBusinesses(bbox);
    const facilities = elements
      .map(normalizeOsmElement)
      .filter(Boolean)
      .slice(0, params.limit);

    return Response.json({ facilities, meta: { ...params, radius, count: facilities.length } });
  } catch (error) {
    if (error instanceof GeoValidationError || error instanceof SyntaxError) {
      return Response.json(
        { error: error instanceof SyntaxError ? "Invalid JSON body" : error.message },
        { status: 400 },
      );
    }
    if (error instanceof OsmOverpassError) {
      // Fail soft: the map should still work with OMNI vendors if OSM is unavailable.
      console.error("[OSM] Overpass request failed:", error.message);
      return Response.json({ facilities: [], meta: { error: "osm_unavailable" } });
    }
    console.error("Error fetching OSM businesses:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = handleOsmNearby;
export const POST = handleOsmNearby;
