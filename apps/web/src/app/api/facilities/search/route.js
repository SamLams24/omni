import { searchNearbyFacilities } from "@/app/api/discovery/discovery-service";
import {
  GeoValidationError,
  parseNearbyParams,
  parseSearchTerm,
} from "@/app/api/discovery/geo";

export async function POST(request) {
  try {
    const body = await request.json();
    const params = parseNearbyParams(body, {
      defaultRadius: 5000,
    });
    const search = parseSearchTerm(body);
    const facilities = await searchNearbyFacilities({ ...params, search });

    return Response.json({
      facilities,
      meta: { ...params, search, count: facilities.length },
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
    console.error("Error searching facilities:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
