import { auditLogs, loginEvents, users } from "@propninja/db";
import { and, count, desc, eq, gte, isNotNull } from "drizzle-orm";
import { AUDIT_ACTIONS } from "../lib/auditActions.js";
import type { Database } from "../lib/db.js";

export async function listFailedLoginsByIp(db: Database, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const rows = await db
    .select({
      ip: auditLogs.ipAddress,
      attempts: count(),
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, AUDIT_ACTIONS.LOGIN_FAILED),
        gte(auditLogs.createdAt, since),
        isNotNull(auditLogs.ipAddress),
      ),
    )
    .groupBy(auditLogs.ipAddress)
    .orderBy(desc(count()));

  return rows.map((row) => ({
    ip: row.ip ?? "unknown",
    attempts: row.attempts,
  }));
}

export async function listRecentExportEvents(db: Database, limit = 50) {
  const rows = await db
    .select({
      id: auditLogs.id,
      userId: auditLogs.userId,
      userName: users.name,
      entityType: auditLogs.entityType,
      entityName: auditLogs.entityName,
      metadata: auditLogs.metadata,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(eq(auditLogs.action, AUDIT_ACTIONS.CSV_EXPORT))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    entityType: row.entityType,
    entityName: row.entityName,
    metadata: row.metadata ?? {},
    ip: row.ipAddress,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listActiveSessions(db: Database) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      userId: loginEvents.userId,
      userName: users.name,
      userEmail: users.email,
      role: users.role,
      lastSeen: loginEvents.createdAt,
      device: loginEvents.device,
      ipAddress: loginEvents.ipAddress,
      userAgent: loginEvents.userAgent,
      sessionsRevokedAt: users.sessionsRevokedAt,
    })
    .from(loginEvents)
    .innerJoin(users, eq(loginEvents.userId, users.id))
    .where(and(eq(users.isActive, true), gte(loginEvents.createdAt, thirtyDaysAgo)))
    .orderBy(desc(loginEvents.createdAt));

  const latestByUser = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByUser.has(row.userId)) {
      latestByUser.set(row.userId, row);
    }
  }

  return [...latestByUser.values()].map((row) => ({
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    role: row.role,
    lastSeen: row.lastSeen.toISOString(),
    device: row.device,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    sessionActive:
      !row.sessionsRevokedAt || row.lastSeen.getTime() > row.sessionsRevokedAt.getTime(),
  }));
}
