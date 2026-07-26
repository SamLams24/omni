import { describe, expect, it } from "vitest";
import {
  parseFacilityCreationInput,
  parseFacilityUpdateInput,
  parseProductCreationInput,
  parseProductUpdateInput,
  parseVendorCreationInput,
  parseVendorUpdateInput,
} from "@/domains/catalog/input";

describe("catalog input", () => {
  it("normalizes vendor creation and accepts zero coordinates", () => {
    expect(parseVendorCreationInput({
      name: "  Marché de Lomé ",
      category: " Alimentation ",
      lat: "0",
      lon: 0,
      products: [{
        name: " Tomate ",
        price: "250",
        unit: " kg ",
      }],
    })).toEqual({
      name: "Marché de Lomé",
      category: "Alimentation",
      description: null,
      phone: "+22800000000",
      lat: 0,
      lon: 0,
      products: [{ name: "Tomate", price: 250, unit: "kg" }],
    });
  });

  it.each([
    [{ name: "Commerce", category: "Divers", lat: 91, lon: 1 }],
    [{ name: "Commerce", category: "Divers", lat: 6, lon: -181 }],
    [{ name: "Commerce", category: "Divers", lat: "", lon: 1 }],
    [{ name: "Commerce", category: "Divers", lat: false, lon: 1 }],
  ])("rejects invalid vendor coordinates", (input) => {
    expect(() => parseVendorCreationInput(input))
      .toThrow(/coordinates|lat and lon/);
  });

  it("requires coordinate updates to be complete", () => {
    expect(() =>
      parseVendorUpdateInput({ vendorId: "vendor-1", lat: 6.1 }),
    ).toThrow("lat and lon must be provided together");
  });

  it("normalizes vendor update fields", () => {
    expect(parseVendorUpdateInput({
      vendorId: "vendor-1",
      name: "  Nouvelle enseigne ",
      email: " contact@omni.tg ",
      lat: "6.13",
      lon: "1.22",
    })).toEqual({
      vendorId: "vendor-1",
      fields: {
        name: "Nouvelle enseigne",
        email: "contact@omni.tg",
        location: { lat: 6.13, lon: 1.22 },
      },
    });
  });

  it("validates facility type and coordinates", () => {
    expect(() =>
      parseFacilityCreationInput({
        vendorId: "vendor-1",
        name: "Point de vente",
        category: "Divers",
        type: "virtual",
        lat: 6.13,
        lon: 1.22,
      }),
    ).toThrow("type must be fixed or mobile");

    expect(parseFacilityCreationInput({
      vendorId: "vendor-1",
      name: " Point de vente ",
      category: " Divers ",
      type: "mobile",
      lat: 0,
      lon: 0,
    })).toMatchObject({
      name: "Point de vente",
      category: "Divers",
      type: "mobile",
      lat: 0,
      lon: 0,
    });
  });

  it("supports a complete facility location update", () => {
    expect(parseFacilityUpdateInput({ lat: 6.15, lon: 1.25 }))
      .toEqual({ location: { lat: 6.15, lon: 1.25 } });
  });

  it.each([0, -1, "invalid", "", true, 100_000_001])(
    "rejects invalid product price %s",
    (invalidPrice) => {
      expect(() =>
        parseProductCreationInput({
          vendorId: "vendor-1",
          name: "Produit",
          price: invalidPrice,
        }),
      ).toThrow("price must be greater than 0");
    },
  );

  it("normalizes a product create payload", () => {
    expect(parseProductCreationInput({
      vendorId: "vendor-1",
      facilityId: "facility-1",
      name: " Pain ",
      price: "150",
    })).toEqual({
      vendorId: "vendor-1",
      facilityId: "facility-1",
      name: "Pain",
      price: 150,
      unit: "pièce",
    });
  });

  it("requires typed, non-empty product updates", () => {
    expect(() =>
      parseProductUpdateInput({
        vendorId: "vendor-1",
        isAvailable: "false",
      }),
    ).toThrow("isAvailable must be a boolean");
    expect(() =>
      parseProductUpdateInput({ vendorId: "vendor-1" }),
    ).toThrow("No fields to update");
  });
});
