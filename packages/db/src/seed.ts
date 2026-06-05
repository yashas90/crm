import "dotenv/config";
import {
  callRecords,
  createDb,
  leadActivities,
  leads,
  organizations,
  tcfConsents,
  users,
} from "@propninja/db";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";

const DEMO_SLUG = "propninja-demo";
const DEMO_ORG_NAME = "PropNinja Demo";
const ADMIN_USER_ID = "00000000-0000-0000-0000-000000000001";
// Must match apps/api/src/lib/password.ts (bcryptjs, 12 rounds).
const BCRYPT_ROUNDS = 12;
const DEV_PASSWORD = "admin";

async function hashDevPassword() {
  return bcrypt.hash(DEV_PASSWORD, BCRYPT_ROUNDS);
}

const STATUSES = ["new", "contacted", "qualified", "negotiation", "won", "lost"] as const;
const TEMPERATURES = ["cold", "warm", "hot"] as const;
const SOURCES = ["website", "referral", "walk-in", "facebook", "google-ads", "cold-call"];
const PROJECTS = [
  "Skyline Residency",
  "Green Park Towers",
  "Lakeview Enclave",
  "Urban Nest",
  "Palm Grove",
  "Horizon Heights",
];
const CITIES = [
  { city: "Mumbai", state: "MH" },
  { city: "Pune", state: "MH" },
  { city: "Bangalore", state: "KA" },
  { city: "Hyderabad", state: "TS" },
  { city: "Delhi", state: "DL" },
  { city: "Chennai", state: "TN" },
];
const DISPOSITIONS = [
  "interested",
  "callback",
  "not_interested",
  "no_answer",
  "wrong_number",
  "qualified",
  "follow_up",
];
const FIRST_NAMES = ["Aarav", "Priya", "Rahul", "Sneha", "Vikram", "Ananya", "Karan", "Meera"];
const LAST_NAMES = ["Sharma", "Patel", "Reddy", "Iyer", "Gupta", "Khan", "Nair", "Desai"];

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!;
}

function randomBetween(min: number, max: number, seed: number) {
  const x = Math.sin(seed) * 10000;
  return min + Math.floor((x - Math.floor(x)) * (max - min + 1));
}

async function clearDemoOrg(db: ReturnType<typeof createDb>) {
  const [orgById] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, SINGLE_TENANT_ORG_ID));
  let org = orgById;
  if (!org) {
    const [orgBySlug] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, DEMO_SLUG));
    org = orgBySlug;
  }
  if (!org) return;

  const orgLeads = await db.select({ id: leads.id }).from(leads).where(eq(leads.orgId, org.id));
  const leadIds = orgLeads.map((row) => row.id);

  if (leadIds.length > 0) {
    await db.delete(tcfConsents).where(inArray(tcfConsents.leadId, leadIds));
    await db.delete(leadActivities).where(inArray(leadActivities.leadId, leadIds));
  }

  await db.delete(callRecords).where(eq(callRecords.orgId, org.id));
  await db.delete(leads).where(eq(leads.orgId, org.id));
  await db.delete(users).where(eq(users.orgId, org.id));
  await db.delete(organizations).where(eq(organizations.id, org.id));
}

export async function seedDemoData(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to seed demo data");
  }

  const db = createDb(connectionString);
  await clearDemoOrg(db);

  const [org] = await db
    .insert(organizations)
    .values({
      id: SINGLE_TENANT_ORG_ID,
      name: DEMO_ORG_NAME,
      slug: DEMO_SLUG,
      subscriptionTier: "demo",
    })
    .returning();

  const passwordHash = await hashDevPassword();

  const userSpecs = [
    { id: ADMIN_USER_ID, email: "admin@propninja.local", name: "PropNinja Admin", role: "admin" },
    { email: "manager@demo.propninja", name: "Demo Manager", role: "manager" },
    { email: "agent1@demo.propninja", name: "Agent One", role: "agent" },
    { email: "agent2@demo.propninja", name: "Agent Two", role: "agent" },
    { email: "agent3@demo.propninja", name: "Agent Three", role: "agent" },
  ] as const;

  const seededUsers = await db
    .insert(users)
    .values(
      userSpecs.map((spec) => ({
        ...spec,
        orgId: org!.id,
        phone: "+919000000000",
        passwordHash,
      })),
    )
    .returning();

  const agents = seededUsers.filter((user) => user.role === "agent");
  const leadCount = 100;
  const leadRows = Array.from({ length: leadCount }, (_, index) => {
    const location = pick(CITIES, index);
    const createdDaysAgo = randomBetween(0, 45, index + 1);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - createdDaysAgo);

    return {
      orgId: org!.id,
      assignedTo: pick(agents, index).id,
      firstName: pick(FIRST_NAMES, index),
      lastName: pick(LAST_NAMES, index + 3),
      email: `lead${index + 1}@example.com`,
      phone: `+9198${String(10000000 + index).slice(0, 8)}`,
      city: location.city,
      state: location.state,
      leadSource: pick(SOURCES, index),
      leadStatus: pick(STATUSES, index + 2),
      temperature: pick(TEMPERATURES, index + 5),
      projectName: pick(PROJECTS, index),
      estimatedValue: String(randomBetween(35, 180, index + 3) * 100_000),
      notes: index % 7 === 0 ? "Interested in 2BHK near metro." : null,
      createdAt,
      updatedAt: createdAt,
      nextFollowupAt:
        index % 4 === 0 ? new Date(Date.now() + randomBetween(0, 5, index) * 86_400_000) : null,
    };
  });

  const seededLeads = await db.insert(leads).values(leadRows).returning();

  const callCount = 300;
  const callValues: (typeof callRecords.$inferInsert)[] = [];
  const activityValues: (typeof leadActivities.$inferInsert)[] = [];

  for (let index = 0; index < callCount; index += 1) {
    const lead = pick(seededLeads, index);
    const agent = pick(agents, index + 1);
    const daysAgo = randomBetween(0, 29, index + 10);
    const hour = randomBetween(9, 18, index + 20);
    const startedAt = new Date();
    startedAt.setDate(startedAt.getDate() - daysAgo);
    startedAt.setHours(hour, randomBetween(0, 59, index), 0, 0);

    const roll = index % 10;
    const status =
      roll < 7 ? "completed" : roll < 9 ? "missed" : pick(["rejected", "failed"] as const, index);
    const durationSeconds =
      status === "completed" ? randomBetween(30, 420, index + 30) : randomBetween(0, 15, index);
    const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);
    const direction = index % 3 === 0 ? "incoming" : "outgoing";
    const disposition =
      status === "completed"
        ? pick(
            DISPOSITIONS.filter((d) => d !== "no_answer"),
            index,
          )
        : status === "missed"
          ? "no_answer"
          : "not_interested";

    callValues.push({
      orgId: org!.id,
      userId: agent.id,
      leadId: lead.id,
      phoneNumber: lead.phone ?? "+919999999999",
      direction,
      status,
      source: index % 5 === 0 ? "mobile-auto" : "mobile-manual",
      startedAt,
      endedAt,
      durationSeconds,
      disposition,
      notes: index % 11 === 0 ? "Follow up next week." : null,
    });
  }

  const seededCalls = await db.insert(callRecords).values(callValues).returning();

  for (const call of seededCalls) {
    if (!call.leadId) continue;

    activityValues.push({
      orgId: org!.id,
      leadId: call.leadId,
      userId: call.userId,
      type: "call",
      metadata: {
        callRecordId: call.id,
        direction: call.direction,
        status: call.status,
        durationSeconds: call.durationSeconds,
        disposition: call.disposition,
        source: call.source,
        phoneNumber: call.phoneNumber,
      },
      createdAt: call.startedAt,
    });
  }

  await db.insert(leadActivities).values(activityValues);

  return {
    orgId: org!.id,
    userIds: seededUsers.map((user) => user.id),
    leadCount: seededLeads.length,
    callCount: seededCalls.length,
  };
}

const isDirectRun = process.argv[1]?.includes("seed");

if (isDirectRun) {
  seedDemoData()
    .then((result) => {
      console.log("Demo data seeded:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}
