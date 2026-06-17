import { auditLogs } from "@propninja/db";
import { and, eq, gte, sql } from "drizzle-orm";
import type { Context } from "hono";
import { AUDIT_ACTIONS } from "../lib/auditActions.js";
import { getClientIp } from "../lib/clientIp.js";
import type { Database } from "../lib/db.js";
import type { AuthUser } from "../middleware/auth.js";
import { auditFromContext } from "./auditService.js";

export const EXPORT_ROW_LIMITS = {
  manager: 500,
  admin: 2000,
} as const;

export const EXPORT_DAILY_LIMITS = {
  manager: 3,
  admin: 10,
} as const;

export function getExportRowLimit(role: AuthUser["role"]): number {
  if (role === "admin") return EXPORT_ROW_LIMITS.admin;
  if (role === "manager") return EXPORT_ROW_LIMITS.manager;
  return 0;
}

export function getExportDailyLimit(role: AuthUser["role"]): number {
  if (role === "admin") return EXPORT_DAILY_LIMITS.admin;
  if (role === "manager") return EXPORT_DAILY_LIMITS.manager;
  return 0;
}

export function canRoleExportCsv(role: AuthUser["role"]): boolean {
  return role === "admin" || role === "manager";
}

function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function countCsvExportsToday(db: Database, userId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.userId, userId),
        eq(auditLogs.action, AUDIT_ACTIONS.CSV_EXPORT),
        gte(auditLogs.createdAt, startOfUtcDay()),
      ),
    );
  return Number(count ?? 0);
}

export type AuthorizeCsvExportInput = {
  exportKind: string;
  filters: Record<string, unknown>;
  rowCount: number;
};

export type AuthorizeCsvExportResult =
  | { ok: true; maxRows: number }
  | { ok: false; status: 403 | 429; message: string };

export async function authorizeCsvExport(
  db: Database,
  user: AuthUser,
  input: AuthorizeCsvExportInput,
): Promise<AuthorizeCsvExportResult> {
  if (!canRoleExportCsv(user.role)) {
    return { ok: false, status: 403, message: "Agents cannot export CSV data" };
  }

  const dailyLimit = getExportDailyLimit(user.role);
  const exportsToday = await countCsvExportsToday(db, user.id);
  if (exportsToday >= dailyLimit) {
    return { ok: false, status: 429, message: "Export limit reached. Contact admin." };
  }

  const maxRows = getExportRowLimit(user.role);
  if (input.rowCount > maxRows) {
    return {
      ok: false,
      status: 403,
      message: `Export exceeds maximum of ${maxRows} rows for your role`,
    };
  }

  return { ok: true, maxRows };
}

export async function logCsvExport(
  c: Context,
  db: Database,
  user: AuthUser,
  input: AuthorizeCsvExportInput,
): Promise<void> {
  await auditFromContext(c, db, {
    userId: user.id,
    action: AUDIT_ACTIONS.CSV_EXPORT,
    entityType: "export",
    entityId: input.exportKind,
    metadata: {
      exportedCount: input.rowCount,
      filters: input.filters,
      ip: getClientIp(c),
    },
  });
}

/** Cap row count for export queries based on role. */
export function capExportRows(role: AuthUser["role"], requested?: number): number {
  const max = getExportRowLimit(role);
  if (max === 0) return 0;
  const size = requested ?? max;
  return Math.min(Math.max(size, 1), max);
}
