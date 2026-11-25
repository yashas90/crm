import { leads } from "@propninja/db";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import type { Database } from "./db.js";
import { phoneLast10Digits } from "./leadPhone.js";

/**
 * Resolve a dialed phone to a CRM lead using last-10 digit matching.
 * Handles `9876543210` vs `+919876543210` (exact string match misses these).
 */
export async function resolveLeadIdByPhone(
  database: Database,
  phoneNumber: string,
): Promise<string | null> {
  const key = phoneLast10Digits(phoneNumber);
  if (!key) return null;

  const [row] = await database
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        eq(leads.orgId, SINGLE_TENANT_ORG_ID),
        isNull(leads.deletedAt),
        or(
          eq(leads.phoneKey, key),
          sql`right(regexp_replace(coalesce(${leads.secondaryPhone}, ''), '[^0-9]', '', 'g'), 10) = ${key}`,
        ),
      ),
    )
    .orderBy(asc(leads.createdAt), asc(leads.id))
    .limit(1);

  return row?.id ?? null;
}
