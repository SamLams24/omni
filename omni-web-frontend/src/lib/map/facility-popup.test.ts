import { describe, expect, it } from "vitest";
import { buildFacilityPopupContent } from "./facility-popup";
import type { MapFacility } from "@/types/business";

const LABELS = {
  status: { UNCONFIRMED: "Unconfirmed", CONFIRMED: "Confirmed", CERTIFIED: "Certified" },
  source: { osm: "From OpenStreetMap", omni: "OMNI business" },
  fields: { phone: "Phone", address: "Address", website: "Website", openingHours: "Hours" },
};

function buildFacility(overrides: Partial<MapFacility> = {}): MapFacility {
  return {
    id: "osm:node:1",
    source: "osm",
    businessId: null,
    name: "Boulangerie",
    category: "shop",
    subcategory: "bakery",
    latitude: 6.13,
    longitude: 1.21,
    address: null,
    phone: null,
    website: null,
    openingHours: null,
    status: "UNCONFIRMED",
    tags: {},
    ...overrides,
  };
}

describe("buildFacilityPopupContent", () => {
  it("renders the facility name and status badge as text, not markup", () => {
    const el = buildFacilityPopupContent(buildFacility({ name: "Chez Ama" }), LABELS);
    expect(el.querySelector(".omni-map-popup__title")?.textContent).toBe("Chez Ama");
    expect(el.querySelector(".omni-map-popup__badge")?.textContent).toBe("Unconfirmed");
  });

  it("never interprets a malicious OSM name as HTML (XSS safety)", () => {
    const malicious = "<img src=x onerror=alert(1)>";
    const el = buildFacilityPopupContent(buildFacility({ name: malicious }), LABELS);
    expect(el.querySelector("img")).toBeNull();
    expect(el.querySelector(".omni-map-popup__title")?.textContent).toBe(malicious);
  });

  it("omits fields that are null instead of rendering an empty row", () => {
    const el = buildFacilityPopupContent(buildFacility(), LABELS);
    expect(el.querySelectorAll(".omni-map-popup__field")).toHaveLength(0);
  });

  it("renders present fields with their label", () => {
    const el = buildFacilityPopupContent(
      buildFacility({ address: "Rue 12", phone: "+22890000000" }),
      LABELS,
    );
    const fields = Array.from(el.querySelectorAll(".omni-map-popup__field")).map(
      (node) => node.textContent,
    );
    expect(fields).toContain("Address: Rue 12");
    expect(fields).toContain("Phone: +22890000000");
  });
});
