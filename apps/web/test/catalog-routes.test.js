import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/utils/sql", () => ({
  default: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

import sql from "@/app/api/utils/sql";
import { POST as createVendor } from "@/app/api/vendors/create/route";
import { POST as createProduct } from "@/app/api/vendors/products/create/route";
import { getAuthenticatedUser } from "@/lib/auth";

describe("catalog route contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue({ id: "user-1" });
  });

  it("returns 400 for invalid catalog JSON", async () => {
    const response = await createVendor(
      new Request("http://localhost/api/vendors/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body" });
    expect(sql).not.toHaveBeenCalled();
  });

  it("persists the normalized unit for onboarding products", async () => {
    sql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "vendor-1" }])
      .mockResolvedValueOnce([{ id: "facility-1" }])
      .mockResolvedValueOnce([]);

    const response = await createVendor(
      new Request("http://localhost/api/vendors/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Commerce",
          category: "Divers",
          lat: 0,
          lon: 0,
          products: [{ name: "Produit", price: "250", unit: "kg" }],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(4);
    const [productQuery, productValues] = sql.mock.calls[3];
    expect(productQuery).toContain(
      "VALUES ($1, $2, $3, $4, $5, true)",
    );
    expect(productValues).toEqual([
      "vendor-1",
      "facility-1",
      "Produit",
      250,
      "kg",
    ]);
  });

  it("requires a product facility to belong to the selected vendor", async () => {
    sql.mockResolvedValueOnce([]);

    const response = await createProduct(
      new Request("http://localhost/api/vendors/products/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: "vendor-1",
          facilityId: "facility-2",
          name: "Produit",
          price: 250,
        }),
      }),
    );

    expect(response.status).toBe(404);
    const query = sql.mock.calls[0][0].join(" ");
    expect(query).toContain("f.vendor_id = v.id");
    expect(query).toContain("f.id IS NOT NULL");
    expect(sql).toHaveBeenCalledTimes(1);
  });
});
