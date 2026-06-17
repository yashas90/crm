import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3001";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/propninja";
const authJwtSecret = process.env.AUTH_JWT_SECRET ?? "super-secret-for-ci";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: "pnpm --filter @propninja/api start",
          url: `${apiURL}/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            ...process.env,
            PORT: "3001",
            DATABASE_URL: databaseUrl,
            AUTH_JWT_SECRET: authJwtSecret,
            NODE_ENV: "development",
          },
        },
        {
          command: "pnpm --filter @propninja/web dev",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            ...process.env,
            NEXT_PUBLIC_API_URL: apiURL,
          },
        },
      ],
});
