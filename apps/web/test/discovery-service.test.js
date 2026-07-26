import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/utils/sql", () => ({
  default: vi.fn(),
}));

import sql from "@/app/api/utils/sql";
import {
  findNearbyFacilities,
  findNearbyVendors,
  searchNearbyFacilities,
} from "@/app/api/discovery/discovery-service";

describe("PostGIS discovery service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries active facilities with bounded positional parameters", async () => {
    sql.mockResolvedValueOnce([
      {
        id: "facility-1",
        lat: "6.13",
        lon: "1.22",
        distance: "90",
        product_count: "2",
        avg_price: "750",
      },
    ]);

    const result = await findNearbyFacilities({
      lat: 6.13,
      lon: 1.22,
      radius: 5000,
      limit: 20,
    });

    const [query, params] = sql.mock.calls[0];
    expect(query).toContain("ST_DWithin");
    expect(query).toContain("v.is_available = true");
    expect(query).toContain("LIMIT $4");
    expect(params).toEqual([1.22, 6.13, 5000, 20]);
    expect(result[0].distance).toBe(90);
  });

  it("escapes search wildcards and excludes unavailable products", async () => {
    sql.mockResolvedValueOnce([]);

    await searchNearbyFacilities({
      lat: 6,
      lon: 1,
      radius: 5000,
      limit: 50,
      search: "bio_100%",
    });

    const [query, params] = sql.mock.calls[0];
    expect(query).toContain("matching_product.is_available = true");
    expect(query).toContain("matching_product.name ILIKE $4");
    expect(params).toEqual([1, 6, 5000, "%bio\\_100\\%%", 50]);
  });

  it("queries active vendors without logging environment details", async () => {
    sql.mockResolvedValueOnce([]);

    await findNearbyVendors({
      lat: 6,
      lon: 1,
      radius: 10000,
      limit: 50,
    });

    const [query, params] = sql.mock.calls[0];
    expect(query).toContain("v.is_online = true");
    expect(query).toContain("v.is_available = true");
    expect(params).toEqual([1, 6, 10000, 50]);
  });
});
