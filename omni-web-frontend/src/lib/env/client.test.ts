import { describe, expect, it, vi, afterEach } from "vitest";
import { loadClientEnv } from "./client";

const REQUIRED = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
  NEXT_PUBLIC_MAP_DEFAULT_LAT: "6.1319",
  NEXT_PUBLIC_MAP_DEFAULT_LON: "1.2228",
  NEXT_PUBLIC_MAP_DEFAULT_ZOOM: "13",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadClientEnv", () => {
  it("parses valid environment variables into typed values", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", REQUIRED.NEXT_PUBLIC_APP_URL);
    vi.stubEnv("NEXT_PUBLIC_API_URL", REQUIRED.NEXT_PUBLIC_API_URL);
    vi.stubEnv("NEXT_PUBLIC_MAP_DEFAULT_LAT", REQUIRED.NEXT_PUBLIC_MAP_DEFAULT_LAT);
    vi.stubEnv("NEXT_PUBLIC_MAP_DEFAULT_LON", REQUIRED.NEXT_PUBLIC_MAP_DEFAULT_LON);
    vi.stubEnv("NEXT_PUBLIC_MAP_DEFAULT_ZOOM", REQUIRED.NEXT_PUBLIC_MAP_DEFAULT_ZOOM);

    const env = loadClientEnv();

    expect(env.NEXT_PUBLIC_API_URL).toBe(REQUIRED.NEXT_PUBLIC_API_URL);
    expect(env.NEXT_PUBLIC_MAP_DEFAULT_LAT).toBe(6.1319);
  });

  it("throws when a required variable is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_API_URL", REQUIRED.NEXT_PUBLIC_API_URL);
    vi.stubEnv("NEXT_PUBLIC_MAP_DEFAULT_LAT", REQUIRED.NEXT_PUBLIC_MAP_DEFAULT_LAT);
    vi.stubEnv("NEXT_PUBLIC_MAP_DEFAULT_LON", REQUIRED.NEXT_PUBLIC_MAP_DEFAULT_LON);
    vi.stubEnv("NEXT_PUBLIC_MAP_DEFAULT_ZOOM", REQUIRED.NEXT_PUBLIC_MAP_DEFAULT_ZOOM);

    expect(() => loadClientEnv()).toThrow(/Invalid client environment variables/);
  });

  it("throws when a numeric variable is not a number", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", REQUIRED.NEXT_PUBLIC_APP_URL);
    vi.stubEnv("NEXT_PUBLIC_API_URL", REQUIRED.NEXT_PUBLIC_API_URL);
    vi.stubEnv("NEXT_PUBLIC_MAP_DEFAULT_LAT", "not-a-number");
    vi.stubEnv("NEXT_PUBLIC_MAP_DEFAULT_LON", REQUIRED.NEXT_PUBLIC_MAP_DEFAULT_LON);
    vi.stubEnv("NEXT_PUBLIC_MAP_DEFAULT_ZOOM", REQUIRED.NEXT_PUBLIC_MAP_DEFAULT_ZOOM);

    expect(() => loadClientEnv()).toThrow();
  });
});
