import { test, expect } from "@playwright/test";

test.describe("Agent Chat", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("tu@email.com").fill("admin@whatsapp-panel.com");
    await page.getByPlaceholder("********").fill("admin123");
    await page.getByRole("button", { name: /iniciar sesion/i }).click();
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });

  test("chat button is visible in header", async ({ page }) => {
    const chatBtn = page.locator("header button").filter({ has: page.locator("svg") }).first();
    await expect(chatBtn).toBeVisible({ timeout: 5000 });
  });

  test("opens chat panel", async ({ page }) => {
    // Find the chat icon button (MessageCircle icon) in header
    const chatBtn = page.locator("header > div:last-child button:first-child");
    await chatBtn.click();
    await expect(page.getByText(/chat interno/i)).toBeVisible({ timeout: 3000 });
  });

  test("closes chat panel with X button", async ({ page }) => {
    const chatBtn = page.locator("header > div:last-child button:first-child");
    await chatBtn.click();
    await expect(page.getByText(/chat interno/i)).toBeVisible({ timeout: 3000 });
    // Click X to close
    await page.locator("button").filter({ has: page.locator("svg[class*='lucide-x']") }).click();
  });
});

test.describe("Settings & Webhooks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("tu@email.com").fill("admin@whatsapp-panel.com");
    await page.getByPlaceholder("********").fill("admin123");
    await page.getByRole("button", { name: /iniciar sesion/i }).click();
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await page.getByRole("link", { name: /configurac|settings/i }).click();
    await expect(page).toHaveURL(/settings/, { timeout: 5000 });
  });

  test("shows all settings tabs", async ({ page }) => {
    await expect(page.getByText(/whatsapp$/i).first()).toBeVisible();
    await expect(page.getByText(/bots/i)).toBeVisible();
    await expect(page.getByText(/webhooks/i)).toBeVisible();
  });

  test("switches between tabs", async ({ page }) => {
    // Click Bots tab
    await page.locator("button").filter({ hasText: /^bots$/i }).first().click();
    await expect(page.getByText(/nuevo bot/i)).toBeVisible({ timeout: 3000 });

    // Click Users tab (admin only)
    await page.locator("button").filter({ hasText: /usuarios/i }).first().click();
    await expect(page.getByText(/nuevo usuario/i)).toBeVisible({ timeout: 3000 });
  });

  test("webhooks tab shows usage instructions", async ({ page }) => {
    await page.locator("button").filter({ hasText: /webhooks/i }).first().click();
    await expect(page.getByText(/como usar en n8n/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/\/api\/webhooks\/trigger/)).toBeVisible();
  });

  test("can toggle theme", async ({ page }) => {
    // Toggle theme button exists
    const themeBtn = page.locator("button").filter({ has: page.locator("svg.lucide-sun, svg.lucide-moon") }).first();
    await expect(themeBtn).toBeVisible({ timeout: 3000 });
    await themeBtn.click();
    // Body should still be visible after toggle
    await expect(page.getByText(/configuracion|settings/i)).toBeVisible({ timeout: 3000 });
  });
});
