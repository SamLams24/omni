import { describe, expect, it } from "vitest";
import { ApiError, ApiNetworkError } from "./api-error";

describe("ApiError", () => {
  it("flags 401 responses as unauthorized", () => {
    const error = new ApiError("Unauthorized", { status: 401 });
    expect(error.isUnauthorized).toBe(true);
    expect(error.isForbidden).toBe(false);
  });

  it("flags 403 responses as forbidden", () => {
    const error = new ApiError("Forbidden", { status: 403 });
    expect(error.isForbidden).toBe(true);
    expect(error.isUnauthorized).toBe(false);
  });

  it("defaults the error code when none is provided", () => {
    const error = new ApiError("Something broke", { status: 500 });
    expect(error.code).toBe("UNKNOWN_ERROR");
  });

  it("preserves a provided error code and request id", () => {
    const error = new ApiError("Validation failed", {
      status: 400,
      code: "VALIDATION_ERROR",
      requestId: "req-123",
    });
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.requestId).toBe("req-123");
  });
});

describe("ApiNetworkError", () => {
  it("wraps the original network failure as the cause", () => {
    const cause = new TypeError("fetch failed");
    const error = new ApiNetworkError(cause);
    expect(error.cause).toBe(cause);
    expect(error.message).toBe("Could not reach the OMNI API");
  });
});
