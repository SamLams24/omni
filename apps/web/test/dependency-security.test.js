import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("dependency security constraints", () => {
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

  it("keeps the web runtime and build chain on patched versions", () => {
    const packageJson = JSON.parse(readProjectFile("package.json"));
    const routerConfig = readProjectFile("react-router.config.ts");
    const viteConfig = readProjectFile("vite.config.ts");
    const workspace = readProjectFile("pnpm-workspace.yaml");
    const lockfile = readProjectFile("pnpm-lock.yaml");

    expect(packageJson.dependencies.hono).toBe("4.13.0");
    expect(packageJson.dependencies["react-router"]).toBe("7.18.2");
    expect(packageJson.dependencies["react-router-dom"]).toBe("7.18.2");
    expect(packageJson.dependencies.ws).toBe("8.21.2");
    expect(packageJson.devDependencies.postcss).toBe("8.5.25");
    expect(packageJson.devDependencies.vite).toBe("6.4.3");

    expect(workspace).toContain('react-router: "7.18.2"');
    expect(workspace).toContain('hono: "4.13.0"');
    expect(workspace).toContain('ws: "8.21.2"');
    expect(workspace).toContain('vite: "6.4.3"');
    expect(workspace).toContain('postcss: "8.5.25"');
    expect(workspace).toContain('"brace-expansion@1": "1.1.18"');
    expect(workspace).toContain('"brace-expansion@2": "2.1.4"');

    expect(lockfile).toContain("react-router@7.18.2:");
    expect(lockfile).toContain("hono@4.13.0:");
    expect(lockfile).toContain("ws@8.21.2:");
    expect(lockfile).toContain("vite@6.4.3:");
    expect(lockfile).toContain("postcss@8.5.25:");
    expect(lockfile).toContain("brace-expansion@1.1.18:");
    expect(lockfile).toContain("brace-expansion@2.1.4:");

    // React Router 7's remaining high advisory only affects its optional RSC
    // runtime. Keep that mode disabled until the dedicated v8 migration.
    expect(packageJson.dependencies).not.toHaveProperty("@vitejs/plugin-rsc");
    expect(packageJson.dependencies).not.toHaveProperty(
      "react-server-dom-webpack",
    );
    expect(routerConfig).not.toContain("unstable_rsc");
    expect(viteConfig).not.toContain("unstable_rsc");
  });
});
