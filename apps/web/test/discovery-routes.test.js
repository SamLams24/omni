import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/discovery/discovery-service", () => ({
  findNearbyFacilities: vi.fn(),
  findNearbyVendors: vi.fn(),
  searchNearbyFacilities: vi.fn(),
}));

import {
  findNearbyFacilities,
  findNearbyVendors,
  searchNearbyFacilities,
} from "@/app/api/discovery/discovery-service";
import {
  GET as getFacilities,
  POST as postFacilities,
} from "@/app/api/facilities/nearby/route";
import { POST as searchFacilities } from "@/app/api/facilities/search/route";
import { GET as getProximity } from "@/app/api/proximity/nearby/route";
import { GET as getVendors } from "@/app/api/vendors/nearby/route";

describe("discovery route contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves public nearby facilities through GET", async () => {
    findNearbyFacilities.mockResolvedValueOnce([{ id: "facility-1" }]);

    const response = await getFacilities(
      new Request(
        "http://localhost/api/facilities/nearby?lat=0&lon=0&radius=5000&limit=10",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(findNearbyFacilities).toHaveBeenCalledWith({
      lat: 0,
      lon: 0,
      radius: 5000,
      limit: 10,
    });
    expect(body.meta.count).toBe(1);
  });

  it("keeps POST compatibility for the map client", async () => {
    findNearbyFacilities.mockResolvedValueOnce([]);

    const response = await postFacilities(
      new Request("http://localhost/api/facilities/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: 6.13, lon: 1.22 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(findNearbyFacilities).toHaveBeenCalledWith({
      lat: 6.13,
      lon: 1.22,
      radius: 10000,
      limit: 50,
    });
  });

  it("rejects invalid coordinates before querying PostGIS", async () => {
    const response = await getVendors(
      new Request(
        "http://localhost/api/vendors/nearby?lat=95&lon=1.22",
      ),
    );

    expect(response.status).toBe(400);
    expect(findNearbyVendors).not.toHaveBeenCalled();
  });

  it("returns a stable proximity entity contract without an identity header", async () => {
    findNearbyFacilities.mockResolvedValueOnce([
      {
        id: "facility-1",
        facility_name: "Boutique Lomé",
        distance: 125,
      },
    ]);

    const response = await getProximity(
      new Request(
        "http://localhost/api/proximity/nearby?lat=6.13&lon=1.22",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entities[0]).toMatchObject({
      type: "facility",
      name: "Boutique Lomé",
      distance_meters: 125,
    });
    expect(body.nearby).toEqual(body.entities);
  });

  it("validates and forwards facility search parameters", async () => {
    searchNearbyFacilities.mockResolvedValueOnce([]);

    const response = await searchFacilities(
      new Request("http://localhost/api/facilities/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: 6.13,
          lon: 1.22,
          search: " tomate ",
          radius: 3000,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(searchNearbyFacilities).toHaveBeenCalledWith({
      lat: 6.13,
      lon: 1.22,
      radius: 3000,
      limit: 50,
      search: "tomate",
    });
  });

  it("returns 400 for malformed JSON bodies", async () => {
    const response = await postFacilities(
      new Request("http://localhost/api/facilities/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body" });
    expect(findNearbyFacilities).not.toHaveBeenCalled();
  });
});
