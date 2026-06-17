import { expect, test } from "@playwright/test";
import { apiAvailable, loginAs } from "./helpers/auth";

test.describe("Reports overview", () => {
  test.beforeEach(({ page }) => {
    test.skip(!apiAvailable(), "Requires API + seeded DB");
    return loginAs(page, "manager");
  });

  test("/reports overview loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: /^reports$/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Loading reports...")).toBeHidden({ timeout: 20_000 });

    const critical = errors.filter((e) => !e.includes("favicon") && !e.includes("ResizeObserver"));
    expect(critical).toEqual([]);
  });

  test('no "undefined" or "NaN" in DOM', async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText("Loading reports...")).toBeHidden({ timeout: 20_000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\bundefined\b/i);
    expect(bodyText).not.toMatch(/\bNaN\b/);
  });

  test("date filter changes displayed range", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText("Loading reports...")).toBeHidden({ timeout: 20_000 });

    const subtitleBefore = await page
      .getByText(/dashboard overview — leads and mobile call activity/i)
      .textContent();

    await page.locator("#datePreset").selectOption("today");
    await expect(page.getByText("Loading reports...")).toBeHidden({ timeout: 20_000 });

    const subtitleAfter = await page
      .getByText(/dashboard overview — leads and mobile call activity/i)
      .textContent();

    expect(subtitleAfter).toBeTruthy();
    expect(subtitleAfter).not.toEqual(subtitleBefore);
  });
});

test.describe("Reports access", () => {
  test("agent redirected to dashboard on /reports/team", async ({ page }) => {
    test.skip(!apiAvailable(), "Requires API + seeded DB");
    await loginAs(page, "agent");
    await page.goto("/reports/team");
    await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/dashboard", {
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: /export csv/i })).toHaveCount(0);
  });
});
