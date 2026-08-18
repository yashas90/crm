import { randomBytes } from "node:crypto";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { Database } from "./index.js";
import {
  callRecords,
  leadActivities,
  leadAssignments,
  leads,
  projects,
  siteVisits,
  users,
} from "./schema/index.js";

const LEAD_PHONE_DIGITS = "8697666260";
const AGENT_NAME = "Shamanth";
const PROJECT_NAME = "Bhartiya Garden Enclave";
const VISIT_DATE = "2026-08-16";
const VISIT_TIME = "11:00";
const SOURCE = "shamanth_month_followup_backfill";
const CALL_BACKFILL_MARKER = `${SOURCE}_call`;
const TARGET_TOTAL_CALLS = 15;

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

const CALL_LOGS: Array<{ dateKey: string; hour: number; minute: number; durationSeconds: number }> =
  [
    { dateKey: "2026-07-18", hour: 10, minute: 45, durationSeconds: 162 },
    { dateKey: "2026-07-19", hour: 11, minute: 20, durationSeconds: 185 },
    { dateKey: "2026-07-21", hour: 17, minute: 10, durationSeconds: 143 },
    { dateKey: "2026-07-23", hour: 12, minute: 5, durationSeconds: 210 },
    { dateKey: "2026-07-25", hour: 11, minute: 15, durationSeconds: 174 },
    { dateKey: "2026-07-29", hour: 16, minute: 30, durationSeconds: 126 },
    { dateKey: "2026-08-01", hour: 11, minute: 40, durationSeconds: 201 },
    { dateKey: "2026-08-03", hour: 10, minute: 55, durationSeconds: 133 },
    { dateKey: "2026-08-06", hour: 15, minute: 25, durationSeconds: 188 },
    { dateKey: "2026-08-08", hour: 10, minute: 35, durationSeconds: 176 },
    { dateKey: "2026-08-10", hour: 18, minute: 15, durationSeconds: 121 },
    { dateKey: "2026-08-12", hour: 11, minute: 50, durationSeconds: 164 },
    { dateKey: "2026-08-14", hour: 16, minute: 5, durationSeconds: 179 },
    { dateKey: "2026-08-15", hour: 15, minute: 40, durationSeconds: 207 },
    { dateKey: "2026-08-16", hour: 9, minute: 55, durationSeconds: 154 },
  ];

export class BackfillRahulVermaniError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackfillRahulVermaniError";
  }
}

export type BackfillRahulVermaniResult = {
  leadId: string;
  leadName: string;
  agentId: string;
  agentName: string;
  followUpCount: number;
  siteVisitDate: string;
  siteVisitTime: string;
  projectName: string;
  totalCalls: number;
};

function publicToken(): string {
  return `SV-2026-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function matchesRahulVermani(lead: {
  phone: string | null;
  firstName: string;
  lastName: string;
}): boolean {
  const digits = (lead.phone ?? "").replace(/\D/g, "");
  if (digits.endsWith(LEAD_PHONE_DIGITS)) return true;
  return (
    lead.firstName.toLowerCase().includes("rahul") &&
    lead.lastName.toLowerCase().includes("vermani")
  );
}

export async function backfillRahulVermani(
  db: Database,
  options: { leadId?: string } = {},
): Promise<BackfillRahulVermaniResult> {
  const [agent] = await db
    .select({ id: users.id, name: users.name, orgId: users.orgId })
    .from(users)
    .where(and(ilike(users.name, `%${AGENT_NAME}%`), eq(users.isActive, true)))
    .limit(1);

  if (!agent) {
    throw new BackfillRahulVermaniError(`Active agent matching "${AGENT_NAME}" was not found`);
  }

  let lead: typeof leads.$inferSelect | undefined;

  if (options.leadId) {
    [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, options.leadId), isNull(leads.deletedAt)))
      .limit(1);

    if (!lead) {
      throw new BackfillRahulVermaniError("Lead not found");
    }
    if (!matchesRahulVermani(lead)) {
      throw new BackfillRahulVermaniError(
        "This backfill only applies to Rahul Vermani (phone ending 8697666260)",
      );
    }
  } else {
    [lead] = await db
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
      throw new BackfillRahulVermaniError(
        `Lead Rahul Vermani (phone …${LEAD_PHONE_DIGITS}) was not found`,
      );
    }
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

  const existingBackfillCalls = await db
    .select({ id: callRecords.id })
    .from(callRecords)
    .where(
      and(
        eq(callRecords.leadId, lead.id),
        eq(callRecords.source, "web-manual"),
        ilike(callRecords.notes, `${CALL_BACKFILL_MARKER}%`),
      ),
    );

  if (existingBackfillCalls.length < TARGET_TOTAL_CALLS) {
    const missingCount = TARGET_TOTAL_CALLS - existingBackfillCalls.length;
    await db.insert(callRecords).values(
      CALL_LOGS.slice(
        existingBackfillCalls.length,
        existingBackfillCalls.length + missingCount,
      ).map((item, index) => {
        const startedAt = ist(item.dateKey, item.hour, item.minute);
        const endedAt = new Date(startedAt.getTime() + item.durationSeconds * 1000);
        return {
          orgId: lead.orgId,
          userId: agent.id,
          leadId: lead.id,
          phoneNumber: lead.phone ?? `+91${LEAD_PHONE_DIGITS}`,
          direction: "outgoing" as const,
          status: "completed" as const,
          source: "web-manual" as const,
          startedAt,
          endedAt,
          durationSeconds: item.durationSeconds,
          disposition: "connected",
          outcome: "follow_up",
          notes: `${CALL_BACKFILL_MARKER}_${existingBackfillCalls.length + index + 1}`,
          createdAt: startedAt,
        };
      }),
    );
  }

  const existingCallActivities = await db
    .select({ id: leadActivities.id })
    .from(leadActivities)
    .where(
      and(
        eq(leadActivities.leadId, lead.id),
        eq(leadActivities.type, "call"),
        sql`${leadActivities.metadata} ->> 'source' = ${SOURCE}`,
      ),
    );

  if (existingCallActivities.length < TARGET_TOTAL_CALLS) {
    const missingCount = TARGET_TOTAL_CALLS - existingCallActivities.length;
    await db.insert(leadActivities).values(
      CALL_LOGS.slice(
        existingCallActivities.length,
        existingCallActivities.length + missingCount,
      ).map((item, index) => {
        const startedAt = ist(item.dateKey, item.hour, item.minute);
        return {
          orgId: lead.orgId,
          leadId: lead.id,
          userId: agent.id,
          type: "call" as const,
          createdAt: startedAt,
          metadata: {
            source: SOURCE,
            durationSeconds: item.durationSeconds,
            direction: "outgoing",
            status: "completed",
            note: `Call ${existingCallActivities.length + index + 1} of ${TARGET_TOTAL_CALLS} — follow-up with Rahul Vermani.`,
          },
        };
      }),
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

  return {
    leadId: lead.id,
    leadName: `${lead.firstName} ${lead.lastName}`.trim(),
    agentId: agent.id,
    agentName: agent.name,
    followUpCount: FOLLOW_UPS.length,
    siteVisitDate: VISIT_DATE,
    siteVisitTime: VISIT_TIME,
    projectName: project?.name ?? PROJECT_NAME,
    totalCalls: TARGET_TOTAL_CALLS,
  };
}

export function isRahulVermaniLead(lead: {
  phone: string | null;
  firstName: string;
  lastName: string;
}): boolean {
  return matchesRahulVermani(lead);
}
