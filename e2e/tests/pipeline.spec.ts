import { test, expect } from "@playwright/test";

test.describe("Pipeline", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("tu@email.com").fill("admin@whatsapp-panel.com");
    await page.getByPlaceholder("********").fill("admin123");
    await page.getByRole("button", { name: /iniciar sesion/i }).click();
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await page.getByRole("link", { name: /pipeline/i }).click();
    await expect(page).toHaveURL(/pipeline/, { timeout: 5000 });
  });

  test("shows pipeline page", async ({ page }) => {
    await expect(page.getByText(/pipeline/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("shows pipeline stages", async ({ page }) => {
    // Stages should be visible as columns
    await expect(page.getByText(/nuevo contacto/i).or(page.getByText(/nuevo contato/i))).toBeVisible({ timeout: 5000 });
  });

  test("create deal button is visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /nuevo deal|nuevo negocio|new deal/i })).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Conversations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("tu@email.com").fill("admin@whatsapp-panel.com");
    await page.getByPlaceholder("********").fill("admin123");
    await page.getByRole("button", { name: /iniciar sesion/i }).click();
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await page.getByRole("link", { name: /conversac/i }).click();
    await expect(page).toHaveURL(/conversations/, { timeout: 5000 });
  });

  test("shows conversations page", async ({ page }) => {
    await expect(page.getByText(/conversac/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("shows contact list or empty state", async ({ page }) => {
    // Should show either contacts or empty state
    await expect(
      page.locator("button, a").filter({ hasText: /juan|maria|carlos|ana|pedro|contact/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });
});
