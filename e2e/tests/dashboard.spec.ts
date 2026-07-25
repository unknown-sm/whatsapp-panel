import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("tu@email.com").fill("admin@whatsapp-panel.com");
    await page.getByPlaceholder("********").fill("admin123");
    await page.getByRole("button", { name: /iniciar sesion/i }).click();
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });

  test("shows dashboard title and stats", async ({ page }) => {
    await expect(page.getByText("Dashboard")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/resumen general/i)).toBeVisible();
    await expect(page.getByText(/bots activos/i)).toBeVisible();
    await expect(page.getByText(/conversaciones/i)).toBeVisible();
  });

  test("shows welcome card", async ({ page }) => {
    await expect(page.getByText(/bienvenido a whatsapp panel/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("link", { name: /bot/i }).first()).toBeVisible();
  });

  test("sidebar navigation is visible", async ({ page }) => {
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /pipeline/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /conversaciones/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /analytics/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /configuracion/i })).toBeVisible();
  });

  test("navigates to pipeline from sidebar", async ({ page }) => {
    await page.getByRole("link", { name: /pipeline/i }).click();
    await expect(page).toHaveURL(/pipeline/, { timeout: 5000 });
  });

  test("navigates to conversations from sidebar", async ({ page }) => {
    await page.getByRole("link", { name: /conversaciones/i }).click();
    await expect(page).toHaveURL(/conversations/, { timeout: 5000 });
  });

  test("navigates to analytics from sidebar", async ({ page }) => {
    await page.getByRole("link", { name: /analytics/i }).click();
    await expect(page).toHaveURL(/analytics/, { timeout: 5000 });
  });

  test("navigates to settings from sidebar", async ({ page }) => {
    await page.getByRole("link", { name: /configuracion/i }).click();
    await expect(page).toHaveURL(/settings/, { timeout: 5000 });
    await expect(page.getByText(/whatsapp/i)).toBeVisible();
  });

  test("logs out successfully", async ({ page }) => {
    await page.locator("button[title='Cerrar sesion'], button[title='Log out'], button[title='Sair']").click();
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });
});
