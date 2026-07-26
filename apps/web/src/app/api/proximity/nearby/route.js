import { findNearbyFacilities } from "@/app/api/discovery/discovery-service";
import {
  GeoValidationError,
  parseNearbyParams,
} from "@/app/api/discovery/geo";

export async function GET(request) {
  try {
    const params = parseNearbyParams(new URL(request.url).searchParams, {
      defaultRadius: 500,
    });
    const facilities = await findNearbyFacilities(params);
    const entities = facilities.map((facility) => ({
      ...facility,
      facility_type: facility.type,
      type: "facility",
      name: facility.facility_name,
      distance_meters: facility.distance,
    }));

    return Response.json({
      entities,
      nearby: entities,
      radius_meters: params.radius,
      meta: { ...params, count: entities.length },
    });
  } catch (error) {
    if (error instanceof GeoValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Error fetching nearby entities:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
