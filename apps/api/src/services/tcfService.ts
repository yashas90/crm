import { leads, tcfConsents } from "@propninja/db";
import { and, desc, eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import type {
  CreateTcfConsentBody,
  RevokeTcfConsentBody,
  UpsertTcfConsentBody,
} from "../lib/validators/tcf.js";

import { CONSENT_TYPES } from "@propninja/types/enums";

function formatConsentRecord(row: {
  id: string;
  consentType: string;
  consented: boolean;
  consentedAt: Date;
  revokedAt: Date | null;
  source: string | null;
  ipAddress: string | null;
}) {
  return {
    id: row.id,
    consent_type: row.consentType,
    consented: row.consented,
    consented_at: row.consentedAt.toISOString(),
    revoked_at: row.revokedAt?.toISOString() ?? null,
    source: row.source,
    ip_address: row.ipAddress,
  };
}

async function assertLeadInTenant(db: Database, leadId: string) {
  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.orgId, SINGLE_TENANT_ORG_ID)))
    .limit(1);

  if (!lead) {
    throw notFound("Lead not found");
  }

  return lead;
}

export function createTcfService(db: Database) {
  return {
    async listByLead(leadId: string) {
      await assertLeadInTenant(db, leadId);

      return db
        .select()
        .from(tcfConsents)
        .where(eq(tcfConsents.leadId, leadId))
        .orderBy(desc(tcfConsents.consentedAt));
    },

    async create(body: CreateTcfConsentBody) {
      await assertLeadInTenant(db, body.leadId);

      const [row] = await db
        .insert(tcfConsents)
        .values({
          leadId: body.leadId,
          consentType: body.consentType,
          consented: body.consented,
          consentedAt: new Date(body.consentedAt),
          source: body.source ?? null,
          ipAddress: body.ipAddress ?? null,
        })
        .returning();

      return row!;
    },

    async revoke(id: string, body: RevokeTcfConsentBody) {
      const [existing] = await db
        .select({
          consent: tcfConsents,
          leadOrgId: leads.orgId,
        })
        .from(tcfConsents)
        .innerJoin(leads, eq(tcfConsents.leadId, leads.id))
        .where(eq(tcfConsents.id, id))
        .limit(1);

      if (!existing || existing.leadOrgId !== SINGLE_TENANT_ORG_ID) {
        throw notFound("Consent record not found");
      }

      const [row] = await db
        .update(tcfConsents)
        .set({
          consented: false,
          revokedAt: body.revokedAt ? new Date(body.revokedAt) : new Date(),
        })
        .where(eq(tcfConsents.id, id))
        .returning();

      return row!;
    },

    async upsert(body: UpsertTcfConsentBody) {
      await assertLeadInTenant(db, body.lead_id);

      const [existing] = await db
        .select()
        .from(tcfConsents)
        .where(
          and(eq(tcfConsents.leadId, body.lead_id), eq(tcfConsents.consentType, body.consent_type)),
        )
        .orderBy(desc(tcfConsents.consentedAt))
        .limit(1);

      const now = new Date();
      const values = {
        consented: body.consented,
        consentedAt: now,
        source: body.source ?? null,
        ipAddress: body.ip_address ?? null,
        revokedAt: body.consented ? null : now,
      };

      if (existing) {
        const [row] = await db
          .update(tcfConsents)
          .set(values)
          .where(eq(tcfConsents.id, existing.id))
          .returning();

        return formatConsentRecord(row!);
      }

      const [row] = await db
        .insert(tcfConsents)
        .values({
          leadId: body.lead_id,
          consentType: body.consent_type,
          ...values,
        })
        .returning();

      return formatConsentRecord(row!);
    },

    async getByChannel(leadId: string) {
      await assertLeadInTenant(db, leadId);

      const rows = await db
        .select()
        .from(tcfConsents)
        .where(eq(tcfConsents.leadId, leadId))
        .orderBy(desc(tcfConsents.consentedAt));

      const latestByType = new Map<string, (typeof rows)[number]>();
      for (const row of rows) {
        if (!latestByType.has(row.consentType)) {
          latestByType.set(row.consentType, row);
        }
      }

      const consents = Object.fromEntries(
        CONSENT_TYPES.map((type) => {
          const row = latestByType.get(type);
          return [type, row ? formatConsentRecord(row) : null];
        }),
      );

      return {
        lead_id: leadId,
        consents,
      };
    },
  };
}

export type TcfService = ReturnType<typeof createTcfService>;
