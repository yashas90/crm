import { expect, test } from "@playwright/test";
import { apiAvailable } from "./helpers/auth";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@propninja.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin";

test.describe("Login page", () => {
  test("renders login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in|login/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("wrong password shows error", async ({ page }) => {
    test.skip(!apiAvailable(), "Requires API + seeded DB");

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill("definitely-wrong-password");
    await page.getByRole("button", { name: /sign in|login/i }).click();
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({ timeout: 10_000 });
  });

  test("valid credentials redirect to dashboard", async ({ page }) => {
    test.skip(!apiAvailable(), "Requires API + seeded DB");

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in|login/i }).click();
    await page.waitForURL(/\/(dashboard|leads|\?)/, { timeout: 15_000 });
  });

  test("mobile viewport 375px — form visible", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });
});

test.describe("Login security", () => {
  test("6 failed logins shows rate limit message", async ({ page }) => {
    test.skip(!apiAvailable(), "Requires API + seeded DB");

    await page.goto("/login");

    for (let i = 0; i < 6; i++) {
      await page.getByLabel(/email/i).fill(`rate-limit-test-${Date.now()}@example.com`);
      await page.getByLabel(/password/i).fill(`wrong-password-${i}`);
      await page.getByRole("button", { name: /sign in|login/i }).click();
      await page.waitForTimeout(300);
    }

    await expect(page.locator("[data-sonner-toast]")).toContainText(/too many login attempts/i, {
      timeout: 15_000,
    });
  });
});

test.describe("Forgot password", () => {
  test("form submits and shows success message", async ({ page }) => {
    test.skip(!apiAvailable(), "Requires API + seeded DB");

    await page.goto("/forgot-password");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByRole("button", { name: /send reset link/i }).click();

    await expect(page.locator("[data-sonner-toast]")).toContainText(/check your inbox/i, {
      timeout: 10_000,
    });
    await expect(page.getByText(/will receive a password reset link/i)).toBeVisible();
  });
});

test.describe("Auth guards", () => {
  test("protected route without session redirects to /login", async ({ page }) => {
    await page.goto("/leads");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });

  test("unknown route shows 404", async ({ page }) => {
    const res = await page.goto("/this-route-does-not-exist-qa");
    expect(res?.status()).toBe(404);
  });
});
