import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { seedDemoData } from "./seed.js";

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

describe("seedDemoData", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;

    const client = postgres(process.env.DATABASE_URL, { max: 1 });
    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
    await client.end();
  });

  it("runs without throwing when DATABASE_URL is reachable", async ({ skip }) => {
    if (!process.env.DATABASE_URL) {
      skip();
    }

    await expect(seedDemoData()).resolves.toMatchObject({
      orgId: expect.any(String),
      leadCount: expect.any(Number),
    });
  });
});
