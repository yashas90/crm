/**
 * Live Meta lead feed for the real-time dashboard (poll + SSE).
 */
import { facebookLeads, leads, users } from "@propninja/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import type { MetaLiveLeadEvent } from "../lib/metaRealtimeBus.js";

export async function listRecentMetaLiveLeads(
  orgId: string = SINGLE_TENANT_ORG_ID,
  options: { limit?: number; sinceMinutes?: number } = {},
): Promise<MetaLiveLeadEvent[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const sinceMinutes = Math.min(Math.max(options.sinceMinutes ?? 60 * 24, 1), 60 * 24 * 7);
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000);

  const rows = await db
    .select({
      leadId: facebookLeads.leadId,
      leadgenId: facebookLeads.leadgenId,
      fullName: facebookLeads.fullName,
      phone: facebookLeads.phone,
      email: facebookLeads.email,
      campaignName: facebookLeads.campaignName,
      adName: facebookLeads.adName,
      adsetName: facebookLeads.adsetName,
      formName: facebookLeads.formName,
      pageName: facebookLeads.pageName,
      createdTime: facebookLeads.createdTime,
      ingestedAt: facebookLeads.ingestedAt,
      assignedTo: leads.assignedTo,
      assignedName: users.name,
      projectName: leads.projectName,
      leadStatus: leads.leadStatus,
      leadSource: leads.leadSource,
    })
    .from(facebookLeads)
    .leftJoin(leads, eq(facebookLeads.leadId, leads.id))
    .leftJoin(users, eq(leads.assignedTo, users.id))
    .where(and(eq(facebookLeads.orgId, orgId), gte(facebookLeads.ingestedAt, since)))
    .orderBy(desc(facebookLeads.ingestedAt))
    .limit(limit);

  return rows
    .filter((row) => row.leadId)
    .map((row) => ({
      type: "meta_lead_ingested" as const,
      at: row.ingestedAt.toISOString(),
      leadId: row.leadId!,
      leadgenId: row.leadgenId,
      fullName: row.fullName,
      phone: row.phone,
      email: row.email,
      assignedTo: row.assignedTo,
      assignedName: row.assignedName ?? null,
      projectName: row.projectName,
      campaignName: row.campaignName,
      adName: row.adName,
      adsetName: row.adsetName,
      formName: row.formName,
      pageName: row.pageName,
      source: row.leadSource ?? "Meta Ads",
      leadStatus: row.leadStatus ?? "new",
      createdTime: row.createdTime?.toISOString() ?? null,
      ingestedAt: row.ingestedAt.toISOString(),
      via: "webhook" as const,
    }));
}
