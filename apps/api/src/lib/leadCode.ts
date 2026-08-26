import { leads } from "@propninja/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { db } from "./db.js";

/** Format a sequence number as PROP-0001 (4-digit zero-padded). */
export function formatLeadCode(sequence: number): string {
  return `PROP-${String(sequence).padStart(4, "0")}`;
}

/** Allocate the next PROP-XXXX code for the tenant. */
export async function allocateNextLeadCode(): Promise<string> {
  const [row] = await db
    .select({
      maxSeq: sql<number | null>`max(
        CASE
          WHEN ${leads.leadCode} ~ '^PROP-[0-9]+$'
          THEN cast(substring(${leads.leadCode} from 6) as integer)
          ELSE NULL
        END
      )`,
    })
    .from(leads)
    .where(and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), isNull(leads.deletedAt)));

  const next = Number(row?.maxSeq ?? 0) + 1;
  return formatLeadCode(next);
}
