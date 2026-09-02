import { leads } from "@propninja/db";
import { eq, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { db } from "./db.js";
import { extractPostgresErrorMeta } from "./postgresErrorMeta.js";

const MAX_LEAD_CODE_ALLOCATION_ATTEMPTS = 8;

/** Format a sequence number as PROP-0001 (4-digit zero-padded). */
export function formatLeadCode(sequence: number): string {
  return `PROP-${String(sequence).padStart(4, "0")}`;
}

function errorNodes(err: unknown): unknown[] {
  const nodes: unknown[] = [];
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    nodes.push(current);
    current = "cause" in current ? (current as { cause: unknown }).cause : undefined;
  }
  return nodes;
}

/** True when Postgres rejected an insert because PROP-XXXX is already taken. */
export function isLeadCodeUniqueViolation(err: unknown): boolean {
  for (const node of errorNodes(err)) {
    const meta = extractPostgresErrorMeta(node);
    if (meta?.code === "23505" && meta.constraint === "leads_org_lead_code_uidx") {
      return true;
    }
    const message =
      node instanceof Error
        ? node.message
        : typeof node === "object" && node && "message" in node
          ? String((node as { message: unknown }).message)
          : "";
    if (message.includes("leads_org_lead_code_uidx")) {
      return true;
    }
  }
  return false;
}

/**
 * Allocate the next PROP-XXXX code for the tenant.
 * Includes archived/deleted leads so codes still reserved by
 * `leads_org_lead_code_uidx` are not reused.
 */
export async function allocateNextLeadCode(offset = 0): Promise<string> {
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
    .where(eq(leads.orgId, SINGLE_TENANT_ORG_ID));

  const next = Number(row?.maxSeq ?? 0) + 1 + offset;
  return formatLeadCode(next);
}

/** Insert a lead, retrying when a concurrent writer takes the same PROP code. */
export async function withAllocatedLeadCode<T>(
  insert: (leadCode: string) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_LEAD_CODE_ALLOCATION_ATTEMPTS; attempt++) {
    try {
      const leadCode = await allocateNextLeadCode(attempt);
      return await insert(leadCode);
    } catch (err) {
      lastError = err;
      if (!isLeadCodeUniqueViolation(err)) {
        throw err;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not allocate a unique lead ID");
}
