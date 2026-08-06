import { describe, expect, it } from "vitest";
import { routing } from "./routing";

describe("i18n routing", () => {
  it("supports French and English", () => {
    expect(routing.locales).toEqual(["fr", "en"]);
  });

  it("defaults to French", () => {
    expect(routing.defaultLocale).toBe("fr");
  });

  it("always prefixes routes with the locale", () => {
    expect(routing.localePrefix).toBe("always");
  });
});
