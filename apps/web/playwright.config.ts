import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL,
		locale: "fr-FR",
		screenshot: "only-on-failure",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "desktop-chromium",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "mobile-chromium",
			use: { ...devices["Pixel 7"] },
		},
	],
	webServer: {
		command:
			"pnpm generate-routes && pnpm exec react-router dev --host 127.0.0.1 --port 4173",
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
