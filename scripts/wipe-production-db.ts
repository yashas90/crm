/**
 * Wipe all application data and bootstrap a clean org + admin for production go-live.
 *
 * Required:
 *   DATABASE_URL
 *   CONFIRM_WIPE=yes
 *
 * Optional:
 *   ADMIN_EMAIL       (default: admin@propninja.com)
 *   ADMIN_PASSWORD    (default: PropNinja@2026)
 *   ORG_NAME          (default: PropNinja)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { SINGLE_TENANT_ORG_ID } from "../packages/db/src/constants.js";
import { createDb, messageTemplates, organizations, users } from "../packages/db/src/index.js";

const ADMIN_USER_ID = "00000000-0000-0000-0000-000000000001";
const BCRYPT_ROUNDS = 12;

const TEMPLATE_DEFAULTS = [
  {
    name: "Greeting",
    category: "greeting" as const,
    content:
      "Hi {{leadName}}, this is {{agentName}} from PropNinja. Thank you for your interest! How can I help you today?",
  },
  {
    name: "Project Details",
    category: "project_details" as const,
    content:
      "Hi {{leadName}}, here are the details for {{projectName}}:\nUnit: {{unitNumber}}\nPrice: ₹{{priceListedRs}}\nLet me know if you'd like to schedule a site visit!",
  },
  {
    name: "Site Visit Reminder",
    category: "site_visit" as const,
    content:
      "Hi {{leadName}}, just confirming your site visit for {{projectName}} tomorrow. Looking forward to seeing you!",
  },
  {
    name: "Follow Up",
    category: "follow_up" as const,
    content:
      "Hi {{leadName}}, just checking in regarding {{projectName}}. Are you still interested? Happy to answer any questions.",
  },
  {
    name: "Thank You",
    category: "custom" as const,
    content:
      "Thank you {{leadName}} for visiting {{projectName}} today! Let me know if you have any questions or would like to proceed further.",
  },
];

function fail(message: string): never {
  console.error(`[wipe-production] ERROR: ${message}`);
  process.exit(1);
}

async function truncateAllTables(connectionString: string) {
  const sql = postgres(connectionString, { max: 1 });
  try {
    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT LIKE '__drizzle%'
      ORDER BY tablename
    `;

    if (tables.length === 0) {
      fail("No public tables found to truncate");
    }

    const names = tables.map((t) => `"${t.tablename.replace(/"/g, '""')}"`).join(", ");
    await sql.unsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
    console.log(`[wipe-production] Truncated ${tables.length} tables.`);
  } finally {
    await sql.end();
  }
}

async function bootstrap() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    fail("DATABASE_URL is not set");
  }
  if (process.env.CONFIRM_WIPE !== "yes") {
    fail("Set CONFIRM_WIPE=yes to run this destructive wipe");
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@propninja.com").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "PropNinja@2026";
  const orgName = process.env.ORG_NAME?.trim() || "PropNinja";

  if (adminPassword.length < 6) {
    fail("ADMIN_PASSWORD must be at least 6 characters");
  }

  console.log("[wipe-production] Wiping all data...");
  await truncateAllTables(connectionString);

  const db = createDb(connectionString);
  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

  const [org] = await db
    .insert(organizations)
    .values({
      id: SINGLE_TENANT_ORG_ID,
      name: orgName,
      slug: "propninja",
    })
    .returning();

  await db.insert(users).values({
    id: ADMIN_USER_ID,
    orgId: org!.id,
    username: "admin",
    email: adminEmail,
    workEmail: adminEmail,
    name: "PropNinja Admin",
    firstName: "PropNinja",
    lastName: "Admin",
    role: "admin",
    roleLabel: "Admin",
    department: "Operations",
    designation: "System Administrator",
    workPhone: "+919000000001",
    phone: "+919000000001",
    timeZone: "Asia/Kolkata",
    passwordHash,
    isActive: true,
    isFirstLogin: false,
  });

  await db.insert(messageTemplates).values(
    TEMPLATE_DEFAULTS.map((template) => ({
      orgId: org!.id,
      name: template.name,
      content: template.content,
      category: template.category,
      createdBy: ADMIN_USER_ID,
    })),
  );

  console.log("[wipe-production] OK: Fresh database ready.");
  console.log(`[wipe-production]     org:      ${orgName}`);
  console.log(`[wipe-production]     admin:    ${adminEmail}`);
  console.log("[wipe-production]     leads:    0");
  console.log("[wipe-production]     calls:    0");
  console.log("[wipe-production]     projects: 0");
}

bootstrap().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
