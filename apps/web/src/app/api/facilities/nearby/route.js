import { findNearbyFacilities } from "@/app/api/discovery/discovery-service";
import {
  GeoValidationError,
  parseNearbyParams,
} from "@/app/api/discovery/geo";

async function readParams(request) {
  if (request.method === "GET") {
    return parseNearbyParams(new URL(request.url).searchParams);
  }
  return parseNearbyParams(await request.json());
}

async function handleNearby(request) {
  try {
    const params = await readParams(request);
    const facilities = await findNearbyFacilities(params);
    return Response.json({
      facilities,
      meta: { ...params, count: facilities.length },
    });
  } catch (error) {
    if (error instanceof GeoValidationError || error instanceof SyntaxError) {
      return Response.json(
        {
          error: error instanceof SyntaxError
            ? "Invalid JSON body"
            : error.message,
        },
        { status: 400 },
      );
    }
    console.error("Error fetching nearby facilities:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = handleNearby;
export const POST = handleNearby;
