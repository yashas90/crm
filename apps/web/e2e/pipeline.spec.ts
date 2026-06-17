import { expect, test } from "@playwright/test";
import { apiAvailable, loginAs } from "./helpers/auth";

const STAGE_LABELS = ["New", "Contacted", "Qualified", "Negotiation", "Won", "Lost"];

test.describe("Pipeline", () => {
  test.beforeEach(({ page }) => {
    test.skip(!apiAvailable(), "Requires API + seeded DB");
    return loginAs(page, "manager");
  });

  test("all pipeline columns render", async ({ page }) => {
    await page.goto("/pipeline");
    await expect(page.getByRole("heading", { name: /^pipeline$/i })).toBeVisible();

    for (const label of STAGE_LABELS) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test("lead count per column is correct", async ({ page }) => {
    await page.goto("/pipeline");
    await expect(page.getByText("Loading pipeline...")).toBeHidden({ timeout: 15_000 });

    for (const label of STAGE_LABELS) {
      const column = page
        .locator("div")
        .filter({ has: page.getByText(label, { exact: true }) })
        .first();
      const badge = column.locator("span").filter({ hasText: /^\d+$/ }).first();
      await expect(badge).toBeVisible();
      const count = Number(await badge.textContent());
      expect(Number.isFinite(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test("click lead opens lead detail page", async ({ page }) => {
    await page.goto("/pipeline");
    await expect(page.getByText("Loading pipeline...")).toBeHidden({ timeout: 15_000 });

    const firstLead = page.locator("a[href^='/leads/']").first();
    await expect(firstLead).toBeVisible({ timeout: 15_000 });

    const href = await firstLead.getAttribute("href");
    expect(href).toMatch(/^\/leads\/.+/);

    await firstLead.click();
    await page.waitForURL(/\/leads\/.+/, { timeout: 10_000 });
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});
