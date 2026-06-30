import { googleCalendarTokens, leads, siteVisits, users } from "@propninja/db";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { decryptSecret, encryptSecret } from "../lib/tokenEncryption.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

export const googleCalendarRoutes = new Hono();

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPES = "https://www.googleapis.com/auth/calendar.events";

function getClientId() {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}
function getClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}
function getRedirectUri() {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.API_BASE_URL ?? "http://localhost:3001"}/api/google-calendar/callback`
  );
}

/** GET /api/google-calendar/connect — returns OAuth URL for the current user */
googleCalendarRoutes.get("/connect", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  if (!getClientId()) {
    return c.json(
      {
        ok: false,
        error: {
          code: "NOT_CONFIGURED",
          message: "Google Calendar not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        },
      },
      503,
    );
  }
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: authUser.id,
  });
  return c.json({ ok: true, data: { url: `${GOOGLE_AUTH_URL}?${params}` } });
});

/** GET /api/google-calendar/callback — OAuth callback, stores tokens */
googleCalendarRoutes.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state"); // userId
  const error = c.req.query("error");

  if (error || !code || !state) {
    return c.html(
      `<html><body><h2>Google Calendar connection failed.</h2><p>${error ?? "Missing code"}</p></body></html>`,
      400,
    );
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return c.html("<html><body><h2>Failed to exchange code for tokens.</h2></body></html>", 500);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  if (!tokens.refresh_token) {
    return c.html(
      "<html><body><h2>No refresh token received. Revoke access in Google Account and try again.</h2></body></html>",
      400,
    );
  }

  const db = c.get("db");
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await db
    .insert(googleCalendarTokens)
    .values({
      userId: state,
      orgId: SINGLE_TENANT_ORG_ID,
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: encryptSecret(tokens.refresh_token),
      expiresAt,
      scope: tokens.scope,
    })
    .onConflictDoUpdate({
      target: googleCalendarTokens.userId,
      set: {
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: encryptSecret(tokens.refresh_token),
        expiresAt,
        scope: tokens.scope,
        updatedAt: new Date(),
      },
    });

  const webUrl = process.env.WEB_BASE_URL ?? "http://localhost:3000";
  return c.redirect(`${webUrl}/settings/integrations?gcal=connected`);
});

/** GET /api/google-calendar/status — check if current user has connected */
googleCalendarRoutes.get("/status", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const db = c.get("db");
  const [token] = await db
    .select({
      userId: googleCalendarTokens.userId,
      calendarId: googleCalendarTokens.calendarId,
      updatedAt: googleCalendarTokens.updatedAt,
    })
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.userId, authUser.id));
  return c.json({
    ok: true,
    data: {
      connected: !!token,
      calendarId: token?.calendarId ?? null,
      connectedAt: token?.updatedAt ?? null,
    },
  });
});

/** DELETE /api/google-calendar/disconnect — revoke and remove tokens */
googleCalendarRoutes.delete("/disconnect", writeRateLimit, async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const db = c.get("db");
  await db.delete(googleCalendarTokens).where(eq(googleCalendarTokens.userId, authUser.id));
  return c.json({ ok: true, data: { disconnected: true } });
});

/** Internal helper: get a valid access token for a user, refreshing if needed */
export async function getValidAccessToken(
  db: ReturnType<typeof import("../lib/db.js").getDb>,
  userId: string,
): Promise<string | null> {
  const [token] = await db
    .select()
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.userId, userId));

  if (!token) return null;

  if (token.expiresAt > new Date(Date.now() + 60_000)) {
    return decryptSecret(token.accessToken);
  }

  // Refresh the token
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

  await db
    .update(googleCalendarTokens)
    .set({
      accessToken: encryptSecret(data.access_token),
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(googleCalendarTokens.userId, userId));

  return data.access_token;
}

/** POST /api/google-calendar/sync-visit/:visitId — sync a single site visit to Google Calendar */
googleCalendarRoutes.post("/sync-visit/:visitId", writeRateLimit, async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const db = c.get("db");
  const visitId = c.req.param("visitId")!;

  const [visitRow] = await db
    .select({
      id: siteVisits.id,
      visitDate: siteVisits.visitDate,
      visitTime: siteVisits.visitTime,
      duration: siteVisits.duration,
      notes: siteVisits.notes,
      propertyAddress: siteVisits.propertyAddress,
      agentId: siteVisits.agentId,
      leadId: siteVisits.leadId,
    })
    .from(siteVisits)
    .where(and(eq(siteVisits.id, visitId), eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID)));

  if (!visitRow) {
    return c.json({ ok: false, error: { code: "NOT_FOUND", message: "Visit not found" } }, 404);
  }

  const targetUserId = authUser.role === "agent" ? authUser.id : visitRow.agentId;
  const accessToken = await getValidAccessToken(db, targetUserId);
  if (!accessToken) {
    return c.json(
      {
        ok: false,
        error: { code: "NOT_CONNECTED", message: "Google Calendar not connected for this user" },
      },
      400,
    );
  }

  const [leadRow] = await db
    .select({ firstName: leads.firstName, lastName: leads.lastName, phone: leads.phone })
    .from(leads)
    .where(eq(leads.id, visitRow.leadId));

  const [agentRow] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, visitRow.agentId));

  const [y, mo, d] = visitRow.visitDate.split("-").map(Number);
  const [h, mi] = visitRow.visitTime.split(":").map(Number);
  const startDt = new Date(y, mo - 1, d, h, mi);
  const endDt = new Date(startDt.getTime() + visitRow.duration * 60_000);

  const toIso = (dt: Date) => dt.toISOString();

  const summary = leadRow ? `Site Visit — ${leadRow.firstName} ${leadRow.lastName}` : "Site Visit";

  const description = [
    leadRow?.phone ? `Lead phone: ${leadRow.phone}` : null,
    visitRow.propertyAddress ? `Property: ${visitRow.propertyAddress}` : null,
    visitRow.notes ? `Notes: ${visitRow.notes}` : null,
    `Agent: ${agentRow?.name ?? ""}`,
  ]
    .filter(Boolean)
    .join("\n");

  const [tokenRow] = await db
    .select({ calendarId: googleCalendarTokens.calendarId })
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.userId, targetUserId));

  const calendarId = tokenRow?.calendarId ?? "primary";

  const event = {
    summary,
    description,
    start: { dateTime: toIso(startDt), timeZone: "Asia/Kolkata" },
    end: { dateTime: toIso(endDt), timeZone: "Asia/Kolkata" },
    extendedProperties: { private: { propninjaVisitId: visitId } },
  };

  const gcalRes = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
    },
  );

  if (!gcalRes.ok) {
    const errText = await gcalRes.text();
    return c.json({ ok: false, error: { code: "GCAL_ERROR", message: errText } }, 502);
  }

  const created = (await gcalRes.json()) as { id: string; htmlLink: string };
  return c.json({ ok: true, data: { eventId: created.id, eventLink: created.htmlLink } });
});

/** PATCH /api/google-calendar/calendar — set preferred calendar ID */
googleCalendarRoutes.patch(
  "/calendar",
  writeRateLimit,
  validate("json", z.object({ calendarId: z.string().min(1) })),
  async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    const db = c.get("db");
    const { calendarId } = c.req.valid("json");
    await db
      .update(googleCalendarTokens)
      .set({ calendarId, updatedAt: new Date() })
      .where(eq(googleCalendarTokens.userId, authUser.id));
    return c.json({ ok: true, data: { calendarId } });
  },
);
