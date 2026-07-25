import { test, expect } from "@playwright/test";

test.describe("Login", () => {
  test("renders login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("WhatsApp Panel")).toBeVisible();
    await expect(page.getByPlaceholder("tu@email.com")).toBeVisible();
    await expect(page.getByPlaceholder("********")).toBeVisible();
    await expect(page.getByRole("button", { name: /iniciar sesion/i })).toBeVisible();
  });

  test("shows error with wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("tu@email.com").fill("noexiste@test.com");
    await page.getByPlaceholder("********").fill("wrong");
    await page.getByRole("button", { name: /iniciar sesion/i }).click();
    await expect(page.getByText(/error/i)).toBeVisible({ timeout: 8000 });
  });

  test("can login with demo credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("tu@email.com").fill("admin@whatsapp-panel.com");
    await page.getByPlaceholder("********").fill("admin123");
    await page.getByRole("button", { name: /iniciar sesion/i }).click();
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await expect(page.getByText(/dashboard/i)).toBeVisible({ timeout: 5000 });
  });

  test("can switch to register form and back", async ({ page }) => {
    await page.goto("/login");
    await page.getByText(/crear cuenta nueva/i).click();
    await expect(page.getByText(/nombre de tu organizacion/i)).toBeVisible();
    await page.getByText(/ya tengo cuenta/i).click();
    await expect(page.getByRole("button", { name: /iniciar sesion/i })).toBeVisible();
  });

  test("language switcher works on login page", async ({ page }) => {
    await page.goto("/login");
    // Check Spanish (default)
    await expect(page.getByRole("button", { name: /iniciar sesion/i })).toBeVisible();
    // Switch to English
    await page.locator("button").filter({ hasText: "ES" }).first().click();
    await page.getByText("EN").click();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    // Switch back
    await page.locator("button").filter({ hasText: "EN" }).first().click();
    await page.getByText("ES").click();
    await expect(page.getByRole("button", { name: /iniciar sesion/i })).toBeVisible();
  });
});
