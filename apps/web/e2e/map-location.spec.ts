import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, page }) => {
	await context.clearPermissions();
	await page.route("**/api/auth/session", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ user: null }),
		});
	});
});

test("a guest can recover when geolocation is unavailable", async ({ page }) => {
	await page.goto("/map");

	await expect(
		page.getByRole("heading", { name: "Activez votre localisation" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: "Utiliser la position par défaut (Lomé)",
		}),
	).toBeVisible();

	await page.getByRole("button", { name: "Saisir les coordonnées" }).click();
	await expect(
		page.getByRole("heading", { name: "Saisir vos coordonnées" }),
	).toBeVisible();

	await page.getByPlaceholder("Latitude (ex: 6.1319)").fill("91");
	await page.getByPlaceholder("Longitude (ex: 1.2228)").fill("1");
	await page.getByRole("button", { name: "Valider" }).click();

	await expect(page.getByText("Coordonnées invalides")).toBeVisible();
	await page.getByRole("button", { name: "Retour" }).click();
	await expect(
		page.getByRole("heading", { name: "Activez votre localisation" }),
	).toBeVisible();
});
