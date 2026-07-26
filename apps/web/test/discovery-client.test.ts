import { describe, expect, it, vi } from "vitest";
import {
  DiscoveryRequestError,
  loadNearbyFacilities,
  searchFacilitiesByText,
} from "@/domains/discovery/client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("discovery client", () => {
  it("loads nearby facilities through the canonical route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ facilities: [{ id: "facility-1" }] }),
    );

    await expect(loadNearbyFacilities(
      { lat: 0, lon: 0 },
      { fetchImpl, radius: 12_000 },
    )).resolves.toEqual([{ id: "facility-1" }]);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/facilities/nearby",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ lat: 0, lon: 0, radius: 12_000 }),
      }),
    );
  });

  it("forwards the explicit normalized text selected by the UI", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ facilities: [] }),
    );

    await searchFacilitiesByText(
      { lat: 6.13, lon: 1.22 },
      "  Alimentation  ",
      { fetchImpl },
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/facilities/search",
      expect.objectContaining({
        body: JSON.stringify({
          lat: 6.13,
          lon: 1.22,
          search: "Alimentation",
          radius: 5_000,
        }),
      }),
    );
  });

  it("rejects an empty search before making a request", () => {
    const fetchImpl = vi.fn();

    expect(() =>
      searchFacilitiesByText(
        { lat: 6.13, lon: 1.22 },
        "   ",
        { fetchImpl },
      ),
    ).toThrow("A search query is required");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not expose an API response body through request errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ stack: "sensitive stack" }, 500),
    );

    await expect(loadNearbyFacilities(
      { lat: 6.13, lon: 1.22 },
      { fetchImpl },
    )).rejects.toMatchObject({
      name: "DiscoveryRequestError",
      message: "Discovery request failed",
      status: 500,
    });
  });

  it("rejects malformed successful payloads", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ vendors: [] }));

    await expect(loadNearbyFacilities(
      { lat: 6.13, lon: 1.22 },
      { fetchImpl },
    )).rejects.toBeInstanceOf(DiscoveryRequestError);
  });
});
