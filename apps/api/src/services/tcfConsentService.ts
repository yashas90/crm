import { leads, tcfConsents } from "@propninja/db";
import type { CONSENT_TYPES } from "@propninja/types/enums";
import { and, desc, eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";

export type ConsentChannel = (typeof CONSENT_TYPES)[number];

/** Latest active TCF consent for a lead channel. */
export async function hasLeadChannelConsent(
  db: Database,
  leadId: string,
  channel: ConsentChannel,
): Promise<boolean> {
  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.orgId, SINGLE_TENANT_ORG_ID)))
    .limit(1);

  if (!lead) return false;

  const [row] = await db
    .select({
      consented: tcfConsents.consented,
      revokedAt: tcfConsents.revokedAt,
    })
    .from(tcfConsents)
    .where(and(eq(tcfConsents.leadId, leadId), eq(tcfConsents.consentType, channel)))
    .orderBy(desc(tcfConsents.consentedAt))
    .limit(1);

  return Boolean(row?.consented && !row.revokedAt);
}
