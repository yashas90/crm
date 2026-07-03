import { leadActivities, leads, projectUnits, projects, siteVisits, users } from "@propninja/db";
import { and, eq, lte } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import type { SiteVisitMessageKind } from "../lib/siteVisitMessages.js";
import { prepareSiteVisitWhatsAppPair } from "../lib/siteVisitMessages.js";
import { siteVisitTimeRange } from "../lib/siteVisitTime.js";
import {
  cancelSiteVisitGoogleCalendar,
  syncSiteVisitToGoogleCalendar,
} from "./googleCalendarService.js";
import { sendSiteVisitWhatsApp } from "./siteVisitWhatsAppService.js";

export type SiteVisitAutomationEvent =
  | "scheduled"
  | "updated"
  | "rescheduled"
  | "cancelled"
  | "completed"
  | "reminder";

type VisitAutomationRow = {
  id: string;
  leadId: string;
  agentId: string;
  visitDate: string;
  visitTime: string;
  duration: number;
  status: string;
  notes: string | null;
  propertyAddress: string | null;
  meetingLocation: string | null;
  mapsLink: string | null;
  tower: string | null;
  customerEmail: string | null;
  leadFirst: string;
  leadLast: string;
  leadPhone: string | null;
  leadEmail: string | null;
  projectName: string | null;
  unitNumber: string | null;
  agentName: string;
  agentPhone: string | null;
  agentPersonalPhone: string | null;
};

async function loadVisitRow(
  database: Database,
  visitId: string,
): Promise<VisitAutomationRow | null> {
  const [row] = await database
    .select({
      id: siteVisits.id,
      leadId: siteVisits.leadId,
      agentId: siteVisits.agentId,
      visitDate: siteVisits.visitDate,
      visitTime: siteVisits.visitTime,
      duration: siteVisits.duration,
      status: siteVisits.status,
      notes: siteVisits.notes,
      propertyAddress: siteVisits.propertyAddress,
      meetingLocation: siteVisits.meetingLocation,
      mapsLink: siteVisits.mapsLink,
      tower: siteVisits.tower,
      customerEmail: siteVisits.customerEmail,
      leadFirst: leads.firstName,
      leadLast: leads.lastName,
      leadPhone: leads.phone,
      leadEmail: leads.email,
      projectName: projects.name,
      unitNumber: projectUnits.unitNumber,
      agentName: users.name,
      agentPhone: users.phone,
      agentPersonalPhone: users.personalPhone,
    })
    .from(siteVisits)
    .innerJoin(leads, eq(siteVisits.leadId, leads.id))
    .innerJoin(users, eq(siteVisits.agentId, users.id))
    .leftJoin(projects, eq(siteVisits.projectId, projects.id))
    .leftJoin(projectUnits, eq(siteVisits.unitId, projectUnits.id))
    .where(and(eq(siteVisits.id, visitId), eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID)))
    .limit(1);

  return row ?? null;
}

function toMessageContext(row: VisitAutomationRow): SiteVisitMessageContext {
  return {
    customerName: `${row.leadFirst} ${row.leadLast}`.trim(),
    customerPhone: row.leadPhone,
    projectName: row.projectName,
    unitLabel: row.unitNumber,
    tower: row.tower,
    visitDate: row.visitDate,
    visitTime: row.visitTime,
    mapsLink: row.mapsLink,
    meetingLocation: row.meetingLocation ?? row.propertyAddress,
    agentName: row.agentName,
    agentPhone: row.agentPhone ?? row.agentPersonalPhone,
    duration: row.duration,
  };
}

async function recordLeadActivity(
  database: Database,
  input: {
    leadId: string;
    userId: string | null;
    kind: string;
    metadata: Record<string, unknown>;
  },
) {
  await database.insert(leadActivities).values({
    orgId: SINGLE_TENANT_ORG_ID,
    leadId: input.leadId,
    userId: input.userId,
    type: "site_visit",
    metadata: { kind: input.kind, ...input.metadata },
  });
}

function activityKindForEvent(event: SiteVisitAutomationEvent): string {
  if (event === "reminder") return "reminder_sent";
  if (event === "cancelled") return "visit_cancelled";
  if (event === "completed") return "visit_completed";
  if (event === "rescheduled") return "visit_rescheduled";
  if (event === "updated") return "visit_updated";
  return "visit_scheduled";
}

export async function runSiteVisitAutomation(
  visitId: string,
  event: SiteVisitAutomationEvent,
  options?: { actorUserId?: string | null; database?: Database },
) {
  const database = options?.database ?? db;
  const row = await loadVisitRow(database, visitId);
  if (!row) return;

  const actorUserId = options?.actorUserId ?? row.agentId;
  const ctx = toMessageContext(row);
  const messageEvent: SiteVisitMessageKind = event;

  if (event === "cancelled") {
    await cancelSiteVisitGoogleCalendar(visitId, database);
  } else if (event !== "reminder") {
    void syncSiteVisitToGoogleCalendar(visitId, {
      status: row.status,
      database,
    }).catch((error) => {
      logger.error("Site visit Google Calendar sync failed", {
        visitId,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }

  const [customerResult, agentResult] = await Promise.all([
    sendSiteVisitWhatsApp({
      leadId: row.leadId,
      sentBy: actorUserId,
      phone: row.leadPhone,
      recipient: "customer",
      event: messageEvent,
      context: ctx,
      database,
    }),
    sendSiteVisitWhatsApp({
      leadId: row.leadId,
      sentBy: actorUserId,
      phone: row.agentPhone ?? row.agentPersonalPhone,
      recipient: "agent",
      event: messageEvent,
      context: ctx,
      database,
    }),
  ]);

  await recordLeadActivity(database, {
    leadId: row.leadId,
    userId: actorUserId,
    kind: activityKindForEvent(event),
    metadata: {
      siteVisitId: visitId,
      visitDate: row.visitDate,
      visitTime: row.visitTime,
      status: row.status,
      whatsappCustomer: customerResult.prepared ? "prepared" : (customerResult.error ?? "skipped"),
      whatsappAgent: agentResult.prepared ? "prepared" : (agentResult.error ?? "skipped"),
      customerWhatsappUrl: customerResult.whatsappUrl,
      agentWhatsappUrl: agentResult.whatsappUrl,
      event,
    },
  });

  if (customerResult.prepared || agentResult.prepared) {
    await recordLeadActivity(database, {
      leadId: row.leadId,
      userId: actorUserId,
      kind: "whatsapp_prepared",
      metadata: {
        siteVisitId: visitId,
        customer: customerResult.prepared,
        agent: agentResult.prepared,
        customerWhatsappUrl: customerResult.whatsappUrl,
        agentWhatsappUrl: agentResult.whatsappUrl,
        event,
      },
    });
  }
}

export async function getSiteVisitWhatsAppLinks(
  visitId: string,
  event: SiteVisitAutomationEvent,
  database: Database = db,
) {
  const row = await loadVisitRow(database, visitId);
  if (!row) return null;

  const ctx = toMessageContext(row);
  const messageEvent: SiteVisitMessageKind = event;
  return prepareSiteVisitWhatsAppPair(messageEvent, ctx, {
    customerPhone: row.leadPhone,
    agentPhone: row.agentPhone ?? row.agentPersonalPhone,
  });
}

export async function markMissedSiteVisits(database: Database = db) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const candidates = await database
    .select({ id: siteVisits.id })
    .from(siteVisits)
    .where(
      and(
        eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
        eq(siteVisits.status, "scheduled"),
        lte(siteVisits.visitDate, today),
      ),
    );

  let updated = 0;
  for (const visit of candidates) {
    const full = await loadVisitRow(database, visit.id);
    if (!full || full.status !== "scheduled") continue;
    const { end } = siteVisitTimeRange(full.visitDate, full.visitTime, full.duration);
    if (end > now) continue;
    await database
      .update(siteVisits)
      .set({ status: "no_show", updatedAt: new Date() })
      .where(eq(siteVisits.id, visit.id));
    updated += 1;
  }
  return updated;
}
