import { auditLogs, users } from "@propninja/db";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { Context } from "hono";
import { getClientIp } from "../lib/clientIp.js";
import type { Database } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import type { ListAuditLogsQuery } from "../lib/validators/audit.js";

export type LogAuditInput = {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAudit(db: Database, input: LogAuditInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      entityName: input.entityName ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    logger.error("Failed to write audit log", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function auditFromContext(
  c: Context,
  db: Database,
  input: LogAuditInput,
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      entityName: input.entityName ?? null,
      metadata: input.metadata ?? {},
      ipAddress: getClientIp(c),
    });
  } catch (error) {
    logger.error("Failed to write audit log", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function createAuditService(db: Database) {
  return {
    logAudit: (input: LogAuditInput) => logAudit(db, input),

    async list(query: ListAuditLogsQuery) {
      const filters = [];

      if (query.userId) {
        filters.push(eq(auditLogs.userId, query.userId));
      }
      if (query.dateFrom) {
        filters.push(gte(auditLogs.createdAt, new Date(query.dateFrom)));
      }
      if (query.dateTo) {
        filters.push(lte(auditLogs.createdAt, new Date(query.dateTo)));
      }

      const rows = await db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          userName: users.name,
          userEmail: users.email,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .innerJoin(users, eq(auditLogs.userId, users.id))
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(auditLogs.createdAt))
        .limit(query.limit);

      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        userName: row.userName,
        userEmail: row.userEmail,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        metadata: row.metadata ?? {},
        createdAt: row.createdAt.toISOString(),
      }));
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
