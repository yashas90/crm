import {
  googleCalendarTokens,
  leads,
  organizations,
  projectUnits,
  projects,
  siteVisits,
  users,
} from "@propninja/db";
import { and, eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { siteVisitTimeRange } from "../lib/siteVisitTime.js";
import { decryptSecret, encryptSecret } from "../lib/tokenEncryption.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

function getClientId() {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}
function getClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}

export function isGoogleCalendarConfigured() {
  return Boolean(getClientId() && getClientSecret());
}

export async function getValidAccessToken(
  database: Database,
  userId: string,
): Promise<string | null> {
  const [token] = await database
    .select()
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.userId, userId));

  if (!token) return null;

  if (token.expiresAt > new Date(Date.now() + 60_000)) {
    return decryptSecret(token.accessToken);
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      refresh_token: decryptSecret(token.refreshToken),
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await database
    .update(googleCalendarTokens)
    .set({
      accessToken: encryptSecret(data.access_token),
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(googleCalendarTokens.userId, userId));

  return data.access_token;
}

export type SiteVisitCalendarContext = {
  visitId: string;
  leadId: string;
  agentId: string;
  visitDate: string;
  visitTime: string;
  duration: number;
  notes: string | null;
  propertyAddress: string | null;
  meetingLocation: string | null;
  mapsLink: string | null;
  tower: string | null;
  projectName: string | null;
  unitNumber: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  agentName: string;
  agentPhone: string | null;
  agentEmail: string | null;
};

async function loadVisitContext(
  database: Database,
  visitId: string,
): Promise<SiteVisitCalendarContext | null> {
  const [row] = await database
    .select({
      id: siteVisits.id,
      leadId: siteVisits.leadId,
      agentId: siteVisits.agentId,
      visitDate: siteVisits.visitDate,
      visitTime: siteVisits.visitTime,
      duration: siteVisits.duration,
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
      agentName: users.name,
      agentPhone: users.phone,
      agentEmail: users.email,
      projectName: projects.name,
      unitNumber: projectUnits.unitNumber,
    })
    .from(siteVisits)
    .innerJoin(leads, eq(siteVisits.leadId, leads.id))
    .innerJoin(users, eq(siteVisits.agentId, users.id))
    .leftJoin(projects, eq(siteVisits.projectId, projects.id))
    .leftJoin(projectUnits, eq(siteVisits.unitId, projectUnits.id))
    .where(and(eq(siteVisits.id, visitId), eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID)))
    .limit(1);

  if (!row) return null;

  return {
    visitId: row.id,
    leadId: row.leadId,
    agentId: row.agentId,
    visitDate: row.visitDate,
    visitTime: row.visitTime,
    duration: row.duration,
    notes: row.notes,
    propertyAddress: row.propertyAddress,
    meetingLocation: row.meetingLocation,
    mapsLink: row.mapsLink,
    tower: row.tower,
    projectName: row.projectName,
    unitNumber: row.unitNumber,
    customerName: `${row.leadFirst} ${row.leadLast}`.trim(),
    customerPhone: row.leadPhone,
    customerEmail: row.customerEmail ?? row.leadEmail,
    agentName: row.agentName,
    agentPhone: row.agentPhone,
    agentEmail: row.agentEmail,
  };
}

function buildCalendarEvent(ctx: SiteVisitCalendarContext, status: string) {
  const { start, end } = siteVisitTimeRange(ctx.visitDate, ctx.visitTime, ctx.duration);
  const projectLabel = ctx.projectName ?? "Project";
  const summary = `Site Visit - ${ctx.customerName} - ${projectLabel}`;
  const location = ctx.mapsLink ?? ctx.meetingLocation ?? ctx.propertyAddress ?? undefined;

  const description = [
    `Customer Name: ${ctx.customerName}`,
    ctx.customerPhone ? `Phone: ${ctx.customerPhone}` : null,
    ctx.projectName ? `Project: ${ctx.projectName}` : null,
    ctx.unitNumber ? `Unit: ${ctx.unitNumber}` : null,
    ctx.tower ? `Tower: ${ctx.tower}` : null,
    ctx.notes ? `Meeting Notes: ${ctx.notes}` : null,
    ctx.mapsLink ? `Google Maps: ${ctx.mapsLink}` : null,
    `CRM Lead ID: ${ctx.leadId}`,
    ctx.meetingLocation ? `Meeting Location: ${ctx.meetingLocation}` : null,
    `Status: ${status}`,
  ]
    .filter(Boolean)
    .join("\n");

  const attendees = ctx.customerEmail
    ? [{ email: ctx.customerEmail, displayName: ctx.customerName }]
    : undefined;

  return {
    summary,
    description,
    location,
    start: { dateTime: start.toISOString(), timeZone: "Asia/Kolkata" },
    end: { dateTime: end.toISOString(), timeZone: "Asia/Kolkata" },
    attendees,
    extendedProperties: { private: { propninjaVisitId: ctx.visitId, propninjaLeadId: ctx.leadId } },
  };
}

async function getCalendarId(database: Database, userId: string) {
  const [token] = await database
    .select({ calendarId: googleCalendarTokens.calendarId })
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.userId, userId));
  return token?.calendarId ?? "primary";
}

export async function syncSiteVisitToGoogleCalendar(
  visitId: string,
  options?: { status?: string; database?: Database },
): Promise<{ eventId: string | null; error?: string }> {
  if (!isGoogleCalendarConfigured()) {
    return { eventId: null, error: "NOT_CONFIGURED" };
  }

  const database = options?.database ?? db;
  const ctx = await loadVisitContext(database, visitId);
  if (!ctx) return { eventId: null, error: "NOT_FOUND" };

  const accessToken = await getValidAccessToken(database, ctx.agentId);
  if (!accessToken) return { eventId: null, error: "NOT_CONNECTED" };

  const [existing] = await database
    .select({
      googleCalendarEventId: siteVisits.googleCalendarEventId,
      status: siteVisits.status,
    })
    .from(siteVisits)
    .where(eq(siteVisits.id, visitId))
    .limit(1);

  const status = options?.status ?? existing?.status ?? "scheduled";
  const calendarId = await getCalendarId(database, ctx.agentId);
  const eventBody = buildCalendarEvent(ctx, status);

  try {
    if (existing?.googleCalendarEventId) {
      const res = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existing.googleCalendarEventId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody),
        },
      );
      if (!res.ok) {
        const errText = await res.text();
        logger.error("Google Calendar event update failed", { visitId, errText });
        return { eventId: null, error: errText };
      }
      return { eventId: existing.googleCalendarEventId };
    }

    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      logger.error("Google Calendar event create failed", { visitId, errText });
      return { eventId: null, error: errText };
    }

    const created = (await res.json()) as { id: string };
    await database
      .update(siteVisits)
      .set({
        googleCalendarEventId: created.id,
        googleCalendarUserId: ctx.agentId,
        updatedAt: new Date(),
      })
      .where(eq(siteVisits.id, visitId));

    return { eventId: created.id };
  } catch (error) {
    logger.error("Google Calendar sync error", {
      visitId,
      message: error instanceof Error ? error.message : String(error),
    });
    return { eventId: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function cancelSiteVisitGoogleCalendar(
  visitId: string,
  database: Database = db,
): Promise<void> {
  const [visit] = await database
    .select({
      googleCalendarEventId: siteVisits.googleCalendarEventId,
      googleCalendarUserId: siteVisits.googleCalendarUserId,
      agentId: siteVisits.agentId,
    })
    .from(siteVisits)
    .where(eq(siteVisits.id, visitId))
    .limit(1);

  if (!visit?.googleCalendarEventId) return;

  const userId = visit.googleCalendarUserId ?? visit.agentId;
  const accessToken = await getValidAccessToken(database, userId);
  if (!accessToken) return;

  const calendarId = await getCalendarId(database, userId);

  try {
    await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(visit.googleCalendarEventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
  } catch (error) {
    logger.error("Google Calendar cancel failed", {
      visitId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getOrgTimezone(database: Database = db): Promise<string> {
  const [org] = await database
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, SINGLE_TENANT_ORG_ID))
    .limit(1);
  const tz = org?.settings?.timezone;
  return typeof tz === "string" && tz.trim() ? tz : "Asia/Kolkata";
}
