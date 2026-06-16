/**
 * Rotate the seeded admin account (admin@propninja.local / admin) after first deploy.
 * Safe to run against production when DATABASE_URL points at Railway Postgres.
 *
 * Required env:
 *   DATABASE_URL          — Postgres connection string
 *   NEW_ADMIN_EMAIL       — replacement login email
 *   NEW_ADMIN_PASSWORD    — replacement password (min 6 characters)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { createDb, users } from "../packages/db/src/index.js";

/** Must match packages/db/src/seed.ts */
const SEED_ADMIN_USER_ID = "00000000-0000-0000-0000-000000000001";
const SEED_ADMIN_EMAIL = "admin@propninja.local";
const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 6;

function fail(message: string): never {
  console.error(`[reset-admin] ERROR: ${message}`);
  process.exit(1);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    fail("DATABASE_URL is not set");
  }

  const newEmail = process.env.NEW_ADMIN_EMAIL?.trim();
  const newPassword = process.env.NEW_ADMIN_PASSWORD;
  if (!newEmail) {
    fail("NEW_ADMIN_EMAIL is not set");
  }
  if (!newPassword) {
    fail("NEW_ADMIN_PASSWORD is not set");
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    fail(`NEW_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    fail("NEW_ADMIN_EMAIL is not a valid email address");
  }

  const db = createDb(databaseUrl);

  let [admin] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, SEED_ADMIN_USER_ID))
    .limit(1);

  if (!admin) {
    [admin] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(and(eq(users.email, SEED_ADMIN_EMAIL), eq(users.role, "admin")))
      .limit(1);
  }

  if (!admin) {
    fail(
      `Seeded admin not found (id=${SEED_ADMIN_USER_ID} or email=${SEED_ADMIN_EMAIL}). Was db:seed run?`,
    );
  }

  if (admin.role !== "admin") {
    fail(`User ${admin.id} is role "${admin.role}", expected "admin"`);
  }

  const [emailConflict] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, newEmail), ne(users.id, admin.id)))
    .limit(1);

  if (emailConflict) {
    fail(`NEW_ADMIN_EMAIL is already in use by user ${emailConflict.id}`);
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await db.update(users).set({ email: newEmail, passwordHash }).where(eq(users.id, admin.id));

  console.log("[reset-admin] OK: Admin credentials updated.");
  console.log(`[reset-admin]     user id:  ${admin.id}`);
  console.log(`[reset-admin]     old email: ${admin.email}`);
  console.log(`[reset-admin]     new email: ${newEmail}`);
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});
