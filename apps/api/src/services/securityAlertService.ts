import { securityAlerts, users } from "@propninja/db";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { sendHtmlEmail } from "../lib/resendEmail.js";

export const SECURITY_ALERT_TYPES = {
  BULK_LEAD_FETCH: "bulk_lead_fetch",
  IP_LEADS_FLOOD: "ip_leads_flood",
  DOCUMENT_HIGH_ACCESS: "document_high_access",
  PORTAL_WEBHOOK_FLOOD: "portal_webhook_flood",
} as const;

export type SecurityAlertType = (typeof SECURITY_ALERT_TYPES)[keyof typeof SECURITY_ALERT_TYPES];

export async function createSecurityAlert(
  db: Database,
  input: {
    userId?: string | null;
    alertType: SecurityAlertType;
    details: Record<string, unknown>;
    ipAddress?: string | null;
  },
): Promise<string> {
  const [row] = await db
    .insert(securityAlerts)
    .values({
      userId: input.userId ?? null,
      alertType: input.alertType,
      details: input.details,
      ipAddress: input.ipAddress ?? null,
    })
    .returning({ id: securityAlerts.id });

  void notifyAdminsOfSecurityAlert(db, input).catch((err) => {
    logger.error("Failed to email admins about security alert", {
      message: err instanceof Error ? err.message : String(err),
    });
  });

  return row!.id;
}

async function notifyAdminsOfSecurityAlert(
  db: Database,
  input: {
    alertType: SecurityAlertType;
    details: Record<string, unknown>;
    ipAddress?: string | null;
    userId?: string | null;
  },
): Promise<void> {
  const admins = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

  if (admins.length === 0) return;

  const subject = `[PropNinja Security] ${input.alertType}`;
  const body = [
    `Alert type: ${input.alertType}`,
    input.userId ? `User ID: ${input.userId}` : null,
    input.ipAddress ? `IP: ${input.ipAddress}` : null,
    `Details: ${JSON.stringify(input.details, null, 2)}`,
  ]
    .filter(Boolean)
    .join("\n");

  await Promise.all(
    admins.map((admin) =>
      sendHtmlEmail({
        to: admin.email,
        subject,
        html: `<pre>${body.replace(/</g, "&lt;")}</pre>`,
        text: body,
      }),
    ),
  );
}

export async function listUnresolvedSecurityAlerts(db: Database) {
  const rows = await db
    .select({
      id: securityAlerts.id,
      userId: securityAlerts.userId,
      alertType: securityAlerts.alertType,
      details: securityAlerts.details,
      ipAddress: securityAlerts.ipAddress,
      resolved: securityAlerts.resolved,
      createdAt: securityAlerts.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(securityAlerts)
    .leftJoin(users, eq(securityAlerts.userId, users.id))
    .where(eq(securityAlerts.resolved, false))
    .orderBy(desc(securityAlerts.createdAt))
    .limit(100);

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    alertType: row.alertType,
    details: row.details ?? {},
    ip: row.ipAddress,
    resolved: row.resolved,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function resolveSecurityAlert(db: Database, alertId: string): Promise<boolean> {
  const [row] = await db
    .update(securityAlerts)
    .set({ resolved: true })
    .where(eq(securityAlerts.id, alertId))
    .returning({ id: securityAlerts.id });
  return Boolean(row);
}
