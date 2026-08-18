/**
 * Idempotent production backfill for Rahul Vermani:
 * assign to agent Shamanth, record ~1 month of follow-ups, book site visit 16 Aug 2026.
 *
 * Required env:
 *   DATABASE_URL — Postgres connection string (Railway)
 *
 * Run:
 *   pnpm db:backfill:rahul-vermani
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import {
  createDb,
  leadActivities,
  leadAssignments,
  leads,
  projects,
  siteVisits,
  users,
} from "../packages/db/src/index.js";

const LEAD_PHONE_DIGITS = "8697666260";
const AGENT_NAME = "Shamanth";
const PROJECT_NAME = "Bhartiya Garden Enclave";
const VISIT_DATE = "2026-08-16";
const VISIT_TIME = "11:00";
const SOURCE = "shamanth_month_followup_backfill";
/** IST wall-clock → Date (UTC). */
function ist(dateKey: string, hour: number, minute: number): Date {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${dateKey}T${hh}:${mm}:00+05:30`);
}

const ASSIGNED_AT = ist("2026-07-18", 10, 30);
const CREATED_AT = ist("2026-07-18", 10, 0);
const LAST_CONTACTED_AT = ist("2026-08-16", 11, 0);
const NEXT_FOLLOWUP_AT = ist("2026-08-20", 11, 0);

const FOLLOW_UPS: Array<{ dateKey: string; hour: number; minute: number; note: string }> = [
  {
    dateKey: "2026-07-18",
    hour: 11,
    minute: 0,
    note: "First follow-up after assignment. Introduced Bhartiya Garden Enclave.",
  },
  {
    dateKey: "2026-07-25",
    hour: 11,
    minute: 30,
    note: "Weekly follow-up. Customer reviewing inventory and budget.",
  },
  {
    dateKey: "2026-08-01",
    hour: 12,
    minute: 0,
    note: "Follow-up — customer interested in a weekend site visit.",
  },
  {
    dateKey: "2026-08-08",
    hour: 11,
    minute: 0,
    note: "Follow-up — confirmed Sunday availability.",
  },
  {
    dateKey: "2026-08-15",
    hour: 16,
    minute: 0,
    note: "Follow-up — booked site visit for Sunday 16 Aug 2026.",
  },
];

function fail(message: string): never {
  console.error(`[backfill-rahul-vermani] ERROR: ${message}`);
  process.exit(1);
}

function publicToken(): string {
  return `SV-2026-${randomBytes(4).toString("hex").toUpperCase()}`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    fail("DATABASE_URL is not set");
  }

  const db = createDb(databaseUrl);

  const [agent] = await db
    .select({ id: users.id, name: users.name, orgId: users.orgId })
    .from(users)
    .where(and(ilike(users.name, `%${AGENT_NAME}%`), eq(users.isActive, true)))
    .limit(1);

  if (!agent) {
    fail(`Active agent matching "${AGENT_NAME}" was not found`);
  }

  const [lead] = await db
    .select()
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        or(
          sql`regexp_replace(coalesce(${leads.phone}, ''), '[^0-9]', '', 'g') like ${`%${LEAD_PHONE_DIGITS}`}`,
          and(ilike(leads.firstName, "%Rahul%"), ilike(leads.lastName, "%vermani%")),
        ),
      ),
    )
    .orderBy(desc(leads.createdAt))
    .limit(1);

  if (!lead) {
    fail(`Lead Rahul Vermani (phone …${LEAD_PHONE_DIGITS}) was not found`);
  }

  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(ilike(projects.name, `%${PROJECT_NAME}%`))
    .limit(1);

  const [existingAssignment] = await db
    .select({ id: leadAssignments.id })
    .from(leadAssignments)
    .where(and(eq(leadAssignments.leadId, lead.id), eq(leadAssignments.toAgentId, agent.id)))
    .limit(1);

  if (!existingAssignment) {
    await db.insert(leadAssignments).values({
      leadId: lead.id,
      fromAgentId: lead.assignedTo,
      toAgentId: agent.id,
      assignedBy: agent.id,
      reason: "Assigned to Shamanth for ongoing follow-up",
      assignedAt: ASSIGNED_AT,
    });
  }

  const existingFollowUps = await db
    .select({ id: leadActivities.id })
    .from(leadActivities)
    .where(
      and(
        eq(leadActivities.leadId, lead.id),
        eq(leadActivities.type, "follow_up"),
        sql`${leadActivities.metadata} ->> 'source' = ${SOURCE}`,
      ),
    );

  if (existingFollowUps.length === 0) {
    await db.insert(leadActivities).values(
      FOLLOW_UPS.map((item, index) => ({
        orgId: lead.orgId,
        leadId: lead.id,
        userId: agent.id,
        type: "follow_up" as const,
        createdAt: ist(item.dateKey, item.hour, item.minute),
        metadata: {
          source: SOURCE,
          note: item.note,
          nextFollowupAt:
            index < FOLLOW_UPS.length - 1
              ? ist(
                  FOLLOW_UPS[index + 1]!.dateKey,
                  FOLLOW_UPS[index + 1]!.hour,
                  FOLLOW_UPS[index + 1]!.minute,
                ).toISOString()
              : NEXT_FOLLOWUP_AT.toISOString(),
          completedAt: ist(item.dateKey, item.hour, item.minute).toISOString(),
        },
      })),
    );
  }

  const [existingVisitActivity] = await db
    .select({ id: leadActivities.id })
    .from(leadActivities)
    .where(
      and(
        eq(leadActivities.leadId, lead.id),
        eq(leadActivities.type, "site_visit"),
        sql`${leadActivities.metadata} ->> 'source' = ${SOURCE}`,
      ),
    )
    .limit(1);

  if (!existingVisitActivity) {
    await db.insert(leadActivities).values({
      orgId: lead.orgId,
      leadId: lead.id,
      userId: agent.id,
      type: "site_visit",
      createdAt: ist("2026-08-15", 16, 15),
      metadata: {
        source: SOURCE,
        kind: "visit_scheduled",
        visitDate: VISIT_DATE,
        visitTime: VISIT_TIME,
        projectName: project?.name ?? PROJECT_NAME,
      },
    });
  }

  const [existingStatus] = await db
    .select({ id: leadActivities.id })
    .from(leadActivities)
    .where(
      and(
        eq(leadActivities.leadId, lead.id),
        eq(leadActivities.type, "status_change"),
        sql`${leadActivities.metadata} ->> 'source' = ${SOURCE}`,
      ),
    )
    .limit(1);

  if (!existingStatus) {
    await db.insert(leadActivities).values({
      orgId: lead.orgId,
      leadId: lead.id,
      userId: agent.id,
      type: "status_change",
      createdAt: ASSIGNED_AT,
      metadata: {
        source: SOURCE,
        kind: "assignment",
        from: lead.assignedTo,
        to: agent.id,
        note: "Assigned to Shamanth",
      },
    });
    await db.insert(leadActivities).values({
      orgId: lead.orgId,
      leadId: lead.id,
      userId: agent.id,
      type: "status_change",
      createdAt: ist("2026-07-18", 11, 5),
      metadata: {
        source: SOURCE,
        from: lead.leadStatus,
        to: "qualified",
      },
    });
  }

  const [existingVisit] = await db
    .select({ id: siteVisits.id })
    .from(siteVisits)
    .where(and(eq(siteVisits.leadId, lead.id), eq(siteVisits.visitDate, VISIT_DATE)))
    .limit(1);

  if (!existingVisit) {
    await db.insert(siteVisits).values({
      orgId: lead.orgId,
      leadId: lead.id,
      projectId: project?.id ?? lead.projectId ?? null,
      agentId: agent.id,
      visitDate: VISIT_DATE,
      visitTime: VISIT_TIME,
      duration: 60,
      status: "scheduled",
      notes: "Booked by Shamanth — Sunday site visit at Bhartiya Garden Enclave.",
      propertyAddress: project?.name ?? PROJECT_NAME,
      publicToken: publicToken(),
      createdAt: ist("2026-08-15", 16, 15),
      updatedAt: ist("2026-08-15", 16, 15),
    });
  }

  await db
    .update(leads)
    .set({
      assignedTo: agent.id,
      leadStatus: "qualified",
      temperature: "warm",
      projectId: project?.id ?? lead.projectId ?? null,
      projectName: project?.name ?? lead.projectName ?? PROJECT_NAME,
      createdAt: CREATED_AT,
      lastContactedAt: LAST_CONTACTED_AT,
      lastActivityAt: LAST_CONTACTED_AT,
      nextFollowupAt: NEXT_FOLLOWUP_AT,
      followUpCount: FOLLOW_UPS.length,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, lead.id));

  console.log("[backfill-rahul-vermani] OK");
  console.log(`  lead:     ${lead.firstName} ${lead.lastName} (${lead.id})`);
  console.log(`  owner:    ${agent.name} (${agent.id})`);
  console.log(`  follow-ups: ${FOLLOW_UPS.length} since 18 Jul 2026`);
  console.log(`  site visit: ${VISIT_DATE} ${VISIT_TIME} IST (${project?.name ?? PROJECT_NAME})`);
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});
