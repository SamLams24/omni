import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("critical dependency security constraints", () => {
  it("keeps Neon Auth transitive dependencies on patched versions", () => {
    const packageJson = JSON.parse(readProjectFile("package.json"));
    const workspace = readProjectFile("pnpm-workspace.yaml");
    const lockfile = readProjectFile("pnpm-lock.yaml");

    expect(packageJson.devDependencies.vitest).toBe("3.2.6");
    expect(workspace).toContain('better-auth: "1.6.26"');
    expect(workspace).toContain('next: "16.2.11"');
    expect(workspace).toContain('vitest: "3.2.6"');
    expect(lockfile).toContain("better-auth@1.6.26:");
    expect(lockfile).not.toContain("next@16.2.2:");
    expect(lockfile).toContain("vitest@3.2.6:");
  });
});
