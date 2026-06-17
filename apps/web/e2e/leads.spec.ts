import { expect, test } from "@playwright/test";
import { apiAvailable, loginAs } from "./helpers/auth";

test.describe("Leads", () => {
  test.beforeEach(({ page }) => {
    test.skip(!apiAvailable(), "Requires API + seeded DB");
    return loginAs(page, "manager");
  });

  test("create lead appears in list", async ({ page }) => {
    const unique = Date.now();
    const firstName = `E2E Lead ${unique}`;
    const phone = `98${String(unique).slice(-8)}`;

    await page.goto("/leads");
    await page.getByRole("button", { name: /add lead/i }).click();
    await page.getByLabel(/first name/i).fill(firstName);
    await page.getByLabel(/^phone$/i).fill(phone);
    await page.getByRole("button", { name: /create lead/i }).click();

    await expect(page.locator("[data-sonner-toast]")).toContainText(/lead created/i, {
      timeout: 10_000,
    });
    await expect(page.getByRole("cell", { name: firstName })).toBeVisible({ timeout: 15_000 });
  });

  test("search by name filters correctly", async ({ page }) => {
    const unique = Date.now();
    const firstName = `SearchTest ${unique}`;
    const phone = `97${String(unique).slice(-8)}`;

    await page.goto("/leads");
    await page.getByRole("button", { name: /add lead/i }).click();
    await page.getByLabel(/first name/i).fill(firstName);
    await page.getByLabel(/^phone$/i).fill(phone);
    await page.getByRole("button", { name: /create lead/i }).click();
    await expect(page.getByRole("cell", { name: firstName })).toBeVisible({ timeout: 15_000 });

    await page.locator("#leads-search").fill(firstName);
    await page.locator("#leads-search").press("Enter");

    await expect(page.getByRole("cell", { name: firstName })).toBeVisible();
    await expect(page.getByText(/\b1 leads\b/)).toBeVisible();
  });

  test("change stage — pipeline reflects it", async ({ page }) => {
    const unique = Date.now();
    const firstName = `StageTest ${unique}`;
    const phone = `96${String(unique).slice(-8)}`;

    await page.goto("/leads");
    await page.getByRole("button", { name: /add lead/i }).click();
    await page.getByLabel(/first name/i).fill(firstName);
    await page.getByLabel(/^phone$/i).fill(phone);
    await page.getByRole("button", { name: /create lead/i }).click();
    await expect(page.getByRole("cell", { name: firstName })).toBeVisible({ timeout: 15_000 });

    await page.goto("/pipeline");
    const leadLink = page.getByRole("link", { name: new RegExp(firstName, "i") });
    await leadLink.hover();
    await page.getByRole("button", { name: /→ contacted/i }).click();

    await expect(page.locator("[data-sonner-toast]")).toContainText(/moved to contacted/i, {
      timeout: 10_000,
    });

    const contactedColumn = page
      .locator("div")
      .filter({ has: page.getByText("Contacted", { exact: true }) })
      .first();
    await expect(
      contactedColumn.getByRole("link", { name: new RegExp(firstName, "i") }),
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test("agent cannot export CSV — button absent", async ({ page }) => {
    await loginAs(page, "agent");
    await page.goto("/leads");
    await expect(page.getByRole("button", { name: /export csv/i })).toHaveCount(0);
    await page.goto("/reports/team");
    await page.waitForURL((url) => url.pathname === "/", { timeout: 10_000 });
    await expect(page.getByRole("button", { name: /export csv/i })).toHaveCount(0);
  });

  test("manager can export CSV — file downloads", async ({ page }) => {
    await page.goto("/reports/team");
    await expect(page.getByRole("heading", { name: /team performance/i })).toBeVisible({
      timeout: 15_000,
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /export csv/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });
});
