import { describe, expect, it } from "vitest";
import {
  isNonProductionFeatureEnabled,
  requireNonProductionFeature,
} from "@/app/api/utils/runtime-flags";

describe("runtime feature flags", () => {
  it("keeps a feature disabled by default", () => {
    expect(isNonProductionFeatureEnabled("ENABLE_DEMO", {})).toBe(false);
  });

  it("allows an explicitly enabled feature outside production", () => {
    expect(
      isNonProductionFeatureEnabled("ENABLE_DEMO", {
        NODE_ENV: "development",
        ENABLE_DEMO: "true",
      })
    ).toBe(true);
  });

  it("never enables an unsafe feature in production", () => {
    expect(
      isNonProductionFeatureEnabled("ENABLE_DEMO", {
        NODE_ENV: "production",
        ENABLE_DEMO: "true",
      })
    ).toBe(false);
  });

  it("returns a non-cacheable 503 response when disabled", async () => {
    const response = requireNonProductionFeature("ENABLE_DEMO", {
      NODE_ENV: "production",
      ENABLE_DEMO: "true",
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "FEATURE_DISABLED",
    });
  });

  it("returns null when the non-production feature is enabled", () => {
    expect(
      requireNonProductionFeature("ENABLE_DEMO", {
        NODE_ENV: "test",
        ENABLE_DEMO: "true",
      })
    ).toBeNull();
  });
});
