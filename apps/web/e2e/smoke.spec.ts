import { expect, test } from "@playwright/test";

test.describe("Public pages smoke", () => {
  test("login page has title", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/propninja|ninja|crm|sign in/i);
  });

  test("login page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
  });

  test("login page LCP under 2.5s (local)", async ({ page }) => {
    const start = Date.now();
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2500);
  });
});
