import {
  leaderboardAnnouncements,
  leads,
  propertyCheckinZones,
  siteVisitFeedback,
  siteVisits,
  users,
  visitReminders,
} from "@propninja/db";
import { formatVisitTimeIst, getIstDateKey } from "@propninja/types/ist";
import {
  DEFAULT_CHECKIN_RADIUS_METERS,
  OUTCOME_LABELS,
  type VisitOutcome,
  checkInTooEarlyMessage,
  haversineMeters,
  isOverdueCheckIn,
  mapVisitEventToLeadStatus,
  outcomeNotificationCopy,
  outcomeToLeadEvent,
  scheduleNotificationCopy,
  visitPinColor,
  visitStart,
  withinRadius,
} from "@propninja/types/site-visit-tracking";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { excelWorkbook } from "../lib/excelSheet.js";
import { buildVisitSummaryPdf } from "../lib/siteVisitPdf.js";
import { appendReminderTier } from "../lib/siteVisitReminders.js";
import { NOTIFICATION_TYPES, createNotificationService } from "./notificationService.js";

export class OutsideZoneError extends Error {
  distanceMeters: number;
  radiusMeters: number;

  constructor(distanceMeters: number, radiusMeters: number) {
    super(`You are ${Math.round(distanceMeters)} m from the property (allowed ${radiusMeters} m).`);
    this.name = "OutsideZoneError";
    this.distanceMeters = Math.round(distanceMeters);
    this.radiusMeters = radiusMeters;
  }
}

export class CheckInTooEarlyError extends Error {
  constructor() {
    super("Check-in opens 30 minutes before the scheduled time");
    this.name = "CheckInTooEarlyError";
  }
}

const REMINDER_OFFSET_MS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "30min": 30 * 60 * 1000,
  now: 0,
};

const TIER_FOR_KIND: Record<string, number> = {
  "24h": 24 * 60,
  "2h": 2 * 60,
  "30min": 30,
  now: 0,
};

const FORWARD_STATUS = ["new", "contacted", "qualified", "negotiation", "won"];

type VisitRow = typeof siteVisits.$inferSelect;

function num(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function leadName(first?: string | null, last?: string | null) {
  return `${first ?? ""} ${last ?? ""}`.trim() || "Lead";
}

function shouldMoveLead(current: string, next: string) {
  if (next === "lost" || next === "won") return current !== next;
  if (current === "won" || current === "lost" || current === "dropped") return false;
  const from = FORWARD_STATUS.indexOf(current);
  const to = FORWARD_STATUS.indexOf(next);
  if (from < 0 || to < 0) return true;
  return to >= from;
}

async function loadVisit(id: string) {
  const [row] = await db
    .select()
    .from(siteVisits)
    .where(and(eq(siteVisits.id, id), eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID)))
    .limit(1);
  return row ?? null;
}

async function loadLead(leadId: string) {
  const [row] = await db
    .select({
      id: leads.id,
      firstName: leads.firstName,
      lastName: leads.lastName,
      phone: leads.phone,
      leadCode: leads.leadCode,
      leadStatus: leads.leadStatus,
      notes: leads.notes,
      estimatedValue: leads.estimatedValue,
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  return row ?? null;
}

async function applyLeadEvent(
  leadId: string,
  event: Parameters<typeof mapVisitEventToLeadStatus>[0],
  extra?: { followUpAt?: Date | null; preferenceNote?: string | null; reason?: string | null },
) {
  const lead = await loadLead(leadId);
  if (!lead) return;
  const mapped = mapVisitEventToLeadStatus(event);
  if (event === "schedule" && !shouldMoveLead(lead.leadStatus, mapped.leadStatus)) return;

  const prior = lead.notes?.trim();
  await db
    .update(leads)
    .set({
      pipelineStage: mapped.pipelineStage,
      leadStatus: mapped.leadStatus,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
      ...(extra?.followUpAt
        ? {
            nextFollowupAt: extra.followUpAt,
            followUpCount: sql`${leads.followUpCount} + 1`,
          }
        : {}),
      ...(mapped.leadStatus === "lost"
        ? {
            closeReason: "other" as const,
            closeReasonNote: extra?.reason ?? "Not interested after site visit",
          }
        : {}),
      ...(extra?.preferenceNote
        ? {
            notes: `${prior ? `${prior}\n` : ""}Wants a different property: ${extra.preferenceNote}`,
          }
        : {}),
    })
    .where(eq(leads.id, leadId));
}

async function managerIdsFor(agentId: string) {
  const [agent] = await db
    .select({ reportingToId: users.reportingToId, name: users.name })
    .from(users)
    .where(eq(users.id, agentId))
    .limit(1);
  if (agent?.reportingToId && agent.reportingToId !== agentId) return [agent.reportingToId];
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.orgId, SINGLE_TENANT_ORG_ID)));
  return admins.map((row) => row.id).filter((id) => id !== agentId);
}

async function notifyManagers(agentId: string, type: string, payload: Record<string, unknown>) {
  const notifications = createNotificationService(db);
  const targets = await managerIdsFor(agentId);
  for (const userId of targets) {
    await notifications.createNotification(userId, type, payload);
  }
}

async function propertyPoint(visit: VisitRow) {
  const lat = num(visit.propertyLat);
  const lng = num(visit.propertyLng);
  const zones = await db
    .select()
    .from(propertyCheckinZones)
    .where(
      and(
        eq(propertyCheckinZones.orgId, SINGLE_TENANT_ORG_ID),
        eq(propertyCheckinZones.active, true),
      ),
    );
  const zone =
    zones.find((row) => visit.projectId && row.projectId === visit.projectId) ??
    zones.find(
      (row) =>
        visit.propertyName &&
        row.propertyName.trim().toLowerCase() === visit.propertyName.trim().toLowerCase(),
    );
  return {
    lat: lat ?? zone?.lat ?? null,
    lng: lng ?? zone?.lng ?? null,
    radius: zone?.radiusMeters ?? DEFAULT_CHECKIN_RADIUS_METERS,
  };
}

export const siteVisitTrackingService = {
  async managerCanAccess(managerId: string, agentId: string) {
    if (managerId === agentId) return true;
    const [agent] = await db
      .select({ reportingToId: users.reportingToId })
      .from(users)
      .where(eq(users.id, agentId))
      .limit(1);
    return agent?.reportingToId === managerId;
  },

  async teamAgentIds(managerId: string) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.reportingToId, managerId));
    return [managerId, ...rows.map((row) => row.id)];
  },

  async onScheduled(visitId: string) {
    const visit = await loadVisit(visitId);
    if (!visit) return;
    const start = visitStart(visit.visitDate, visit.visitTime, visit.scheduledAt?.toISOString());
    const now = Date.now();
    if (start.getTime() > now) {
      const rows = Object.entries(REMINDER_OFFSET_MS)
        .map(([kind, offset]) => ({
          visitId: visit.id,
          kind,
          scheduledFor: new Date(start.getTime() - offset),
        }))
        .filter((row) => row.scheduledFor.getTime() > now || row.kind === "now");
      if (rows.length > 0) {
        await db.insert(visitReminders).values(rows).onConflictDoNothing();
      }
    }
    await applyLeadEvent(visit.leadId, "schedule");

    const lead = await loadLead(visit.leadId);
    const [agent] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, visit.agentId))
      .limit(1);
    const property = visit.propertyName || visit.propertyAddress || "Property";
    const copy = scheduleNotificationCopy({
      leadName: leadName(lead?.firstName, lead?.lastName),
      leadCode: lead?.leadCode,
      property,
      dateLabel: visit.visitDate,
      timeLabel: formatVisitTimeIst(visit.visitTime),
    });
    await createNotificationService(db).createNotification(
      visit.agentId,
      NOTIFICATION_TYPES.SITE_VISIT_SCHEDULED,
      {
        siteVisitId: visit.id,
        leadId: visit.leadId,
        leadName: leadName(lead?.firstName, lead?.lastName),
        leadCode: lead?.leadCode ?? null,
        visitDate: visit.visitDate,
        visitTime: visit.visitTime,
        property,
        companions: visit.companions,
        scheduledBy: agent?.name ?? null,
        title: copy.title,
        message: copy.message,
      },
    );
  },

  async checkIn(
    visitId: string,
    input: { lat?: number | null; lng?: number | null; confirmOutside?: boolean },
    now = new Date(),
  ) {
    const visit = await loadVisit(visitId);
    if (!visit) return null;
    const early = checkInTooEarlyMessage(
      visit.visitDate,
      visit.visitTime,
      now,
      visit.scheduledAt?.toISOString(),
    );
    if (early) throw new CheckInTooEarlyError();
    if (visit.status === "cancelled" || visit.status === "completed") {
      throw new Error("This visit cannot be checked in");
    }

    const point = await propertyPoint(visit);
    let verified = false;
    let distance: number | null = null;
    let unverifiedReason: string | null = null;

    if (point.lat == null || point.lng == null || input.lat == null || input.lng == null) {
      unverifiedReason = "Location could not be verified";
    } else {
      distance = haversineMeters(input.lat, input.lng, point.lat, point.lng);
      if (withinRadius(distance, point.radius)) {
        verified = true;
      } else if (!input.confirmOutside) {
        throw new OutsideZoneError(distance, point.radius);
      } else {
        unverifiedReason = `Checked in ${Math.round(distance)} m outside the zone`;
      }
    }

    await db
      .update(siteVisits)
      .set({
        status: visit.status === "in_progress" ? "in_progress" : "checked_in",
        checkinAt: visit.checkinAt ?? now,
        checkinLat: input.lat != null ? String(input.lat) : visit.checkinLat,
        checkinLng: input.lng != null ? String(input.lng) : visit.checkinLng,
        distanceMeters: distance != null ? Math.round(distance) : null,
        checkinVerified: verified,
        updatedAt: now,
      })
      .where(eq(siteVisits.id, visit.id));

    const lead = await loadLead(visit.leadId);
    const [agent] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, visit.agentId))
      .limit(1);
    const property = visit.propertyName || visit.propertyAddress || "Property";
    const who = leadName(lead?.firstName, lead?.lastName);
    await notifyManagers(visit.agentId, NOTIFICATION_TYPES.SITE_VISIT_CHECKIN, {
      siteVisitId: visit.id,
      leadId: visit.leadId,
      leadName: who,
      property,
      title: "Site visit check-in",
      message: verified
        ? `${agent?.name ?? "Agent"} checked in at ${property} for ${who}.`
        : `${agent?.name ?? "Agent"} checked in at ${property} for ${who}. ${unverifiedReason}.`,
    });

    return {
      verified,
      distanceMeters: distance != null ? Math.round(distance) : null,
      radiusMeters: point.radius,
      message: unverifiedReason,
    };
  },

  async recordArrival(
    visitId: string,
    input: { customerPresent: "present" | "running_late" | "no_show"; companionCount?: number },
  ) {
    const visit = await loadVisit(visitId);
    if (!visit) return null;
    const now = new Date();
    if (input.customerPresent === "no_show") {
      await db
        .update(siteVisits)
        .set({
          status: "no_show",
          customerPresent: "no_show",
          updatedAt: now,
        })
        .where(eq(siteVisits.id, visit.id));
      const lead = await loadLead(visit.leadId);
      const [agent] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, visit.agentId))
        .limit(1);
      const property = visit.propertyName || visit.propertyAddress || "Property";
      const who = leadName(lead?.firstName, lead?.lastName);
      await notifyManagers(visit.agentId, NOTIFICATION_TYPES.SITE_VISIT_NO_SHOW, {
        siteVisitId: visit.id,
        leadId: visit.leadId,
        leadName: who,
        property,
        title: "Site visit no-show",
        message: `${agent?.name ?? "Agent"} marked no-show for ${who} at ${property}.`,
      });
      return { status: "no_show" as const };
    }

    await db
      .update(siteVisits)
      .set({
        status: "in_progress",
        customerPresent: input.customerPresent,
        companions:
          input.companionCount != null ? `count:${input.companionCount}` : visit.companions,
        checkinAt: visit.checkinAt ?? now,
        updatedAt: now,
      })
      .where(eq(siteVisits.id, visit.id));
    return { status: "in_progress" as const };
  },

  async saveFeedback(
    visitId: string,
    input: {
      answers: Array<{ question: string; answer: string; answerType: string }>;
      notes?: string | null;
      photos?: string[];
      signature?: string | null;
    },
  ) {
    const visit = await loadVisit(visitId);
    if (!visit) return null;
    const blob: Record<string, unknown> = {};
    for (const row of input.answers) blob[row.question] = row.answer;
    await db.delete(siteVisitFeedback).where(eq(siteVisitFeedback.visitId, visit.id));
    if (input.answers.length > 0) {
      await db.insert(siteVisitFeedback).values(
        input.answers.map((row) => ({
          visitId: visit.id,
          question: row.question,
          answer: row.answer,
          answerType: row.answerType,
        })),
      );
    }
    await db
      .update(siteVisits)
      .set({
        feedback: blob,
        agentNotes: input.notes ?? visit.agentNotes,
        visitPhotos: input.photos ?? visit.visitPhotos,
        customerSignature: input.signature ?? visit.customerSignature,
        updatedAt: new Date(),
      })
      .where(eq(siteVisits.id, visit.id));
    return { saved: true };
  },

  async checkout(
    visitId: string,
    actorId: string,
    input: {
      outcome: VisitOutcome;
      nextAction?: string | null;
      nextActionDate?: string | null;
      reason?: string | null;
      preferenceNote?: string | null;
      signature?: string | null;
    },
  ) {
    const visit = await loadVisit(visitId);
    if (!visit) return null;
    const now = new Date();
    const started = visit.checkinAt ?? visit.scheduledAt ?? now;
    const durationMinutes = Math.max(1, Math.round((now.getTime() - started.getTime()) / 60_000));
    const followUp = input.nextActionDate ? new Date(input.nextActionDate) : null;
    await db
      .update(siteVisits)
      .set({
        status: "completed",
        outcome: input.outcome,
        outcomeNote: input.reason ?? input.preferenceNote ?? visit.outcomeNote,
        nextAction: input.nextAction ?? null,
        nextActionDate: followUp,
        checkoutAt: now,
        durationMinutes,
        customerSignature: input.signature ?? visit.customerSignature,
        updatedAt: now,
      })
      .where(eq(siteVisits.id, visit.id));

    const event = outcomeToLeadEvent(input.outcome);
    if (event) {
      await applyLeadEvent(visit.leadId, event, {
        followUpAt: followUp,
        preferenceNote: input.preferenceNote,
        reason: input.reason,
      });
    }

    const lead = await loadLead(visit.leadId);
    const [agent] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, visit.agentId))
      .limit(1);
    const property = visit.propertyName || visit.propertyAddress || "Property";
    const who = leadName(lead?.firstName, lead?.lastName);
    const outcomeLabel = OUTCOME_LABELS[input.outcome] ?? input.outcome;
    const copy = outcomeNotificationCopy({
      agentName: agent?.name ?? "Agent",
      leadName: who,
      property,
      outcomeLabel,
    });
    await notifyManagers(visit.agentId, NOTIFICATION_TYPES.SITE_VISIT_COMPLETED, {
      siteVisitId: visit.id,
      leadId: visit.leadId,
      leadName: who,
      property,
      outcome: input.outcome,
      title: copy.title,
      message: copy.message,
    });

    if (input.outcome === "deal_closed") {
      const body = `Deal closed: ${agent?.name ?? "Agent"} closed ${who} at ${property}.`;
      await db.insert(leaderboardAnnouncements).values({
        orgId: SINGLE_TENANT_ORG_ID,
        kind: "announcement",
        body,
        active: true,
        createdBy: actorId,
      });
      await notifyManagers(visit.agentId, NOTIFICATION_TYPES.SITE_VISIT_DEAL_CLOSED, {
        siteVisitId: visit.id,
        leadId: visit.leadId,
        leadName: who,
        property,
        title: "Deal closed",
        message: body,
      });
    }

    return { status: "completed" as const, durationMinutes, outcome: input.outcome };
  },

  async processDueReminders(now = new Date()) {
    const due = await db
      .select({
        id: visitReminders.id,
        kind: visitReminders.kind,
        visitId: visitReminders.visitId,
      })
      .from(visitReminders)
      .innerJoin(siteVisits, eq(visitReminders.visitId, siteVisits.id))
      .where(
        and(
          eq(visitReminders.isSent, false),
          lte(visitReminders.scheduledFor, now),
          inArray(siteVisits.status, ["scheduled", "reminder_sent"]),
        ),
      );

    const notifications = createNotificationService(db);
    let sent = 0;
    for (const row of due) {
      const visit = await loadVisit(row.visitId);
      if (!visit) continue;
      const lead = await loadLead(visit.leadId);
      const property = visit.propertyName || visit.propertyAddress || "Property";
      const who = leadName(lead?.firstName, lead?.lastName);
      const label =
        row.kind === "24h"
          ? "in 24 hours"
          : row.kind === "2h"
            ? "in 2 hours"
            : row.kind === "30min"
              ? "in 30 minutes"
              : "starting now";
      await notifications.createNotification(
        visit.agentId,
        NOTIFICATION_TYPES.SITE_VISIT_REMINDER,
        {
          siteVisitId: visit.id,
          leadId: visit.leadId,
          leadName: who,
          visitDate: visit.visitDate,
          visitTime: visit.visitTime,
          property,
          tierMinutes: TIER_FOR_KIND[row.kind] ?? 0,
          title: "Site visit reminder",
          message: `Site visit ${label}: ${who} at ${property} on ${visit.visitDate} at ${formatVisitTimeIst(visit.visitTime)} IST.`,
        },
      );
      await db
        .update(visitReminders)
        .set({ isSent: true, sentAt: now })
        .where(eq(visitReminders.id, row.id));
      const tier = TIER_FOR_KIND[row.kind] ?? 0;
      await db
        .update(siteVisits)
        .set({
          remindersSent: appendReminderTier(visit.remindersSent, tier, now.toISOString()),
          reminderSent: true,
          status: visit.status === "scheduled" ? "reminder_sent" : visit.status,
          updatedAt: now,
        })
        .where(eq(siteVisits.id, visit.id));
      sent += 1;
    }

    const open = await db
      .select()
      .from(siteVisits)
      .where(
        and(
          eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
          eq(siteVisits.overdueAlertSent, false),
          inArray(siteVisits.status, ["scheduled", "reminder_sent"]),
          gte(siteVisits.visitDate, sql`CURRENT_DATE - INTERVAL '1 day'`),
        ),
      );

    let overdue = 0;
    for (const visit of open) {
      if (
        !isOverdueCheckIn(
          visit.status,
          visit.visitDate,
          visit.visitTime,
          now,
          visit.scheduledAt?.toISOString(),
        )
      ) {
        continue;
      }
      const lead = await loadLead(visit.leadId);
      const [agent] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, visit.agentId))
        .limit(1);
      const property = visit.propertyName || visit.propertyAddress || "Property";
      const who = leadName(lead?.firstName, lead?.lastName);
      await notifyManagers(visit.agentId, NOTIFICATION_TYPES.SITE_VISIT_OVERDUE, {
        siteVisitId: visit.id,
        leadId: visit.leadId,
        leadName: who,
        property,
        title: "Check-in overdue",
        message: `${agent?.name ?? "Agent"} has not checked in for ${who} at ${property}. Scheduled ${formatVisitTimeIst(visit.visitTime)} IST, 15 minutes overdue.`,
      });
      await db
        .update(siteVisits)
        .set({ overdueAlertSent: true, updatedAt: now })
        .where(eq(siteVisits.id, visit.id));
      overdue += 1;
    }

    return { sent, overdue };
  },

  async managerBoard(viewer: { id: string; role: "admin" | "manager" | "agent" }) {
    const today = getIstDateKey();
    const agentIds =
      viewer.role === "admin"
        ? null
        : viewer.role === "manager"
          ? await this.teamAgentIds(viewer.id)
          : [viewer.id];
    const rows = await db
      .select({
        id: siteVisits.id,
        agentId: siteVisits.agentId,
        agentName: users.name,
        visitDate: siteVisits.visitDate,
        visitTime: siteVisits.visitTime,
        status: siteVisits.status,
        propertyName: siteVisits.propertyName,
        propertyAddress: siteVisits.propertyAddress,
        propertyLat: siteVisits.propertyLat,
        propertyLng: siteVisits.propertyLng,
        checkinAt: siteVisits.checkinAt,
        checkinLat: siteVisits.checkinLat,
        checkinLng: siteVisits.checkinLng,
        checkinVerified: siteVisits.checkinVerified,
        outcome: siteVisits.outcome,
        leadFirst: leads.firstName,
        leadLast: leads.lastName,
        leadCode: leads.leadCode,
      })
      .from(siteVisits)
      .leftJoin(users, eq(siteVisits.agentId, users.id))
      .leftJoin(leads, eq(siteVisits.leadId, leads.id))
      .where(
        and(
          eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
          eq(siteVisits.visitDate, today),
          agentIds ? inArray(siteVisits.agentId, agentIds) : undefined,
        ),
      )
      .orderBy(siteVisits.visitTime);

    const now = new Date();
    const items = rows.map((row) => {
      const property = row.propertyName || row.propertyAddress || "Property";
      return {
        id: row.id,
        agentId: row.agentId,
        agentName: row.agentName ?? "Agent",
        time: row.visitTime,
        property,
        leadName: leadName(row.leadFirst, row.leadLast),
        leadCode: row.leadCode,
        status: row.status,
        checkinAt: row.checkinAt?.toISOString() ?? null,
        outcome: row.outcome,
        gpsVerified: row.checkinVerified,
        color: visitPinColor(row.status, row.visitDate, row.visitTime, now),
        mapsUrl:
          num(row.propertyLat) != null && num(row.propertyLng) != null
            ? `https://www.google.com/maps/search/?api=1&query=${num(row.propertyLat)},${num(row.propertyLng)}`
            : row.propertyAddress
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.propertyAddress)}`
              : null,
        agentMapsUrl:
          num(row.checkinLat) != null && num(row.checkinLng) != null
            ? `https://www.google.com/maps/search/?api=1&query=${num(row.checkinLat)},${num(row.checkinLng)}`
            : null,
      };
    });

    const countStatus = (pred: (status: string) => boolean) =>
      items.filter((item) => pred(item.status)).length;
    return {
      mapSdk: false,
      counts: {
        scheduled: countStatus((status) => status === "scheduled" || status === "reminder_sent"),
        checkedIn: countStatus((status) => status === "checked_in" || status === "in_progress"),
        completed: countStatus((status) => status === "completed"),
        upcoming: items.filter((item) => item.color === "yellow").length,
        noShow: countStatus((status) => status === "no_show"),
      },
      items,
    };
  },

  async agentReport(agentId: string) {
    const rows = await db
      .select()
      .from(siteVisits)
      .where(and(eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID), eq(siteVisits.agentId, agentId)))
      .orderBy(desc(siteVisits.visitDate));
    return summarizeVisits(rows);
  },

  async adminReport() {
    const rows = await db
      .select({
        visit: siteVisits,
        agentName: users.name,
      })
      .from(siteVisits)
      .leftJoin(users, eq(siteVisits.agentId, users.id))
      .where(eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID))
      .orderBy(desc(siteVisits.visitDate))
      .limit(2000);
    const visits = rows.map((row) => ({ ...row.visit, agentName: row.agentName }));
    const summary = summarizeVisits(visits);
    const byAgent = new Map<string, VisitRow[]>();
    for (const visit of visits) {
      const key = visit.agentName ?? visit.agentId;
      const list = byAgent.get(key) ?? [];
      list.push(visit);
      byAgent.set(key, list);
    }
    const agents = [...byAgent.entries()].map(([name, list]) => ({
      agentName: name,
      ...summarizeVisits(list),
    }));
    return { ...summary, agents };
  },

  adminWorkbook(report: Awaited<ReturnType<typeof this.adminReport>>) {
    const headers = ["Section", "Name", "Value"];
    const rows: string[][] = [
      ["Totals", "Visits", String(report.total)],
      ["Totals", "No-show rate", report.noShowRate],
      ["Totals", "Avg duration min", report.avgDurationMinutes],
      ["Totals", "Avg stars", report.avgStars],
      ["Totals", "Conversion %", report.conversionPercent],
    ];
    for (const [name, count] of Object.entries(report.outcomes)) {
      rows.push(["Outcome", name, String(count)]);
    }
    for (const [name, count] of report.concerns) rows.push(["Concern", name, String(count)]);
    for (const agent of report.agents) {
      rows.push(["Agent", agent.agentName, `${agent.conversionPercent} conversion`]);
    }
    for (const peak of report.peakHours) rows.push(["Peak hour", peak.hour, String(peak.count)]);
    for (const reaction of report.propertyReactions) {
      rows.push(["Property", reaction.property, reaction.avgStars]);
    }
    return excelWorkbook("Site visits", headers, rows);
  },

  async summaryPdf(visitId: string) {
    const visit = await loadVisit(visitId);
    if (!visit) return null;
    const lead = await loadLead(visit.leadId);
    const [agent] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, visit.agentId))
      .limit(1);
    const feedbackRows = await db
      .select()
      .from(siteVisitFeedback)
      .where(eq(siteVisitFeedback.visitId, visit.id));
    const summary =
      feedbackRows.length > 0
        ? feedbackRows.map((row) => `${row.question}: ${row.answer}`)
        : Object.entries(visit.feedback ?? {}).map(([key, value]) => `${key}: ${String(value)}`);
    const pdf = await buildVisitSummaryPdf({
      visitDate: visit.visitDate,
      visitTime: visit.visitTime,
      durationMinutes: visit.durationMinutes,
      property: visit.propertyName || visit.propertyAddress || "Property",
      customerName: leadName(lead?.firstName, lead?.lastName),
      customerPhone: lead?.phone ?? null,
      leadCode: lead?.leadCode ?? null,
      feedbackSummary: summary.slice(0, 20),
      outcome: visit.outcome
        ? (OUTCOME_LABELS[visit.outcome as VisitOutcome] ?? visit.outcome)
        : null,
      nextStep: visit.nextAction,
      agentName: agent?.name ?? "Agent",
      signature: visit.customerSignature,
    });
    return pdf;
  },
};

function answerList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // plain text answer
  }
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function summarizeVisits<T extends VisitRow>(rows: T[]) {
  const outcomes: Record<string, number> = {};
  const concerns = new Map<string, number>();
  const hours = new Map<string, number>();
  const propertyStars = new Map<string, number[]>();
  let durationSum = 0;
  let durationCount = 0;
  let starsSum = 0;
  let starsCount = 0;
  let noShow = 0;
  let won = 0;
  for (const visit of rows) {
    if (visit.status === "no_show") noShow += 1;
    if (visit.outcome) outcomes[visit.outcome] = (outcomes[visit.outcome] ?? 0) + 1;
    if (visit.outcome === "deal_closed") won += 1;
    if (visit.durationMinutes) {
      durationSum += visit.durationMinutes;
      durationCount += 1;
    }
    const hour = visit.visitTime.slice(0, 2);
    hours.set(hour, (hours.get(hour) ?? 0) + 1);
    const feedback = visit.feedback ?? {};
    const stars = Number(feedback["First reaction"]);
    if (Number.isFinite(stars) && stars > 0) {
      starsSum += stars;
      starsCount += 1;
      const property = visit.propertyName || visit.propertyAddress || "Property";
      const list = propertyStars.get(property) ?? [];
      list.push(stars);
      propertyStars.set(property, list);
    }
    for (const concern of answerList(feedback.Concerns)) {
      concerns.set(concern, (concerns.get(concern) ?? 0) + 1);
    }
  }
  const finished = rows.filter((row) => row.status === "completed").length;
  return {
    total: rows.length,
    completed: finished,
    noShow,
    noShowRate: rows.length ? `${Math.round((noShow / rows.length) * 100)}%` : "0%",
    avgDurationMinutes: durationCount ? String(Math.round(durationSum / durationCount)) : "0",
    avgStars: starsCount ? (starsSum / starsCount).toFixed(1) : "0",
    conversionPercent: finished ? `${Math.round((won / finished) * 100)}%` : "0%",
    outcomes,
    concerns: [...concerns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    peakHours: [...hours.entries()]
      .map(([hour, count]) => ({ hour: `${hour}:00 IST`, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    propertyReactions: [...propertyStars.entries()].map(([property, stars]) => ({
      property,
      avgStars: (stars.reduce((sum, value) => sum + value, 0) / stars.length).toFixed(1),
      visits: stars.length,
    })),
  };
}
