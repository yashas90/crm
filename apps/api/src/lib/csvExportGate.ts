import type { Context } from "hono";
import { jsonError } from "../lib/response.js";
import type { AuthUser } from "../middleware/auth.js";
import {
  authorizeCsvExport,
  capExportRows,
  logCsvExport,
} from "../services/exportSecurityService.js";

export type CsvExportGateInput = {
  exportKind: string;
  filters: Record<string, unknown>;
  rowCount: number;
};

/** Enforce role-based CSV export limits and audit every export. */
export async function enforceCsvExportGate(
  c: Context,
  user: AuthUser,
  input: CsvExportGateInput,
): Promise<Response | null> {
  const db = c.get("db");
  const auth = await authorizeCsvExport(db, user, input);
  if (!auth.ok) {
    return jsonError(
      c,
      auth.status === 429 ? "RATE_LIMITED" : "FORBIDDEN",
      auth.message,
      auth.status,
    );
  }
  await logCsvExport(c, db, user, input);
  return null;
}

export { capExportRows };
