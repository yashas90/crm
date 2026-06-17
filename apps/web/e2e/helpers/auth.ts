import type { Page } from "@playwright/test";

export type E2ERole = "admin" | "manager" | "agent";

const CREDENTIALS: Record<E2ERole, { email: string; password: string }> = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? "admin@propninja.local",
    password: process.env.E2E_ADMIN_PASSWORD ?? "admin",
  },
  manager: {
    email: process.env.E2E_MANAGER_EMAIL ?? "manager@demo.propninja",
    password: process.env.E2E_MANAGER_PASSWORD ?? "admin",
  },
  agent: {
    email: process.env.E2E_AGENT_EMAIL ?? "agent1@demo.propninja",
    password: process.env.E2E_AGENT_PASSWORD ?? "admin",
  },
};

export function apiAvailable(): boolean {
  return process.env.E2E_API_AVAILABLE === "1" || process.env.CI === "true";
}

export async function loginAs(page: Page, role: E2ERole): Promise<void> {
  const { email, password } = CREDENTIALS[role];
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|login/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20_000 });
}
