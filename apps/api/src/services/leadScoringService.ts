import {
  callRecords,
  leadActivities,
  leads,
  organizations,
  siteVisits,
  tcfConsents,
} from "@propninja/db";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import {
  DEFAULT_LEAD_SCORING_RULES,
  HOT_LEAD_SCORE_THRESHOLD,
  LEAD_SCORING_RULE_LABELS,
  type LeadScoringInput,
  type ScoreFactor,
  WARM_LEAD_SCORE_THRESHOLD,
  calculateLeadScore,
  isLeadScoringEnabled,
  scoreTier,
} from "../lib/leadScoring.js";

const RECENT_NOTE_DAYS = 3;

function activeLeadStatusFilter() {
  return sql`${leads.leadStatus} not in ('lost', 'won')`;
}

async function countConsecutiveNoAnswers(leadId: string): Promise<number> {
  const rows = await db
    .select({ outcome: callRecords.outcome })
    .from(callRecords)
    .where(and(eq(callRecords.orgId, SINGLE_TENANT_ORG_ID), eq(callRecords.leadId, leadId)))
    .orderBy(desc(callRecords.startedAt))
    .limit(10);

  let streak = 0;
  for (const row of rows) {
    if (row.outcome === "no_answer") {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

async function isLeadReEnquired(leadId: string, createdAt: Date): Promise<boolean> {
  const [row] = await db
    .select({
      exists: sql<boolean>`exists (
      SELECT 1 FROM ${leadActivities} la
      WHERE la.lead_id = ${leadId}
        AND la.org_id = ${SINGLE_TENANT_ORG_ID}
        AND (
          (
            la.type = 'status_change'
            AND la.metadata->>'from' IN ('lost', 'won')
            AND la.metadata->>'to' IN ('new', 'contacted', 'qualified', 'negotiation')
          )
          OR la.metadata->>'kind' = 're_enquiry'
        )
      OR (
        SELECT COUNT(*)::int FROM ${leadActivities} la2
        WHERE la2.lead_id = ${leadId}
          AND la2.org_id = ${SINGLE_TENANT_ORG_ID}
          AND la2.metadata->>'kind' = 'ad_lead'
      ) >= 2
      OR EXISTS (
        SELECT 1 FROM ${leadActivities} la3
        WHERE la3.lead_id = ${leadId}
          AND la3.org_id = ${SINGLE_TENANT_ORG_ID}
          AND la3.metadata->>'kind' = 'ad_lead'
          AND la3.created_at > ${createdAt} + interval '1 day'
      )
    )`,
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  return Boolean(row?.exists);
}

export async function gatherLeadScoringInput(
  lead: {
    id: string;
    createdAt: Date;
    lastContactedAt: Date | null;
    leadSource: string | null;
    whatsappRepliedAt: Date | null;
  },
  now = new Date(),
): Promise<LeadScoringInput> {
  const noteCutoff = new Date(now.getTime() - RECENT_NOTE_DAYS * 86_400_000);

  const [
    answeredRow,
    scheduledRow,
    completedRow,
    recentNoteRow,
    dncRow,
    consecutiveNoAnswers,
    isReEnquired,
  ] = await Promise.all([
    db
      .select({ id: callRecords.id })
      .from(callRecords)
      .where(
        and(
          eq(callRecords.leadId, lead.id),
          eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
          eq(callRecords.outcome, "answered"),
        ),
      )
      .limit(1),
    db
      .select({ id: siteVisits.id })
      .from(siteVisits)
      .where(
        and(
          eq(siteVisits.leadId, lead.id),
          eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
          eq(siteVisits.status, "scheduled"),
        ),
      )
      .limit(1),
    db
      .select({ id: siteVisits.id })
      .from(siteVisits)
      .where(
        and(
          eq(siteVisits.leadId, lead.id),
          eq(siteVisits.orgId, SINGLE_TENANT_ORG_ID),
          eq(siteVisits.status, "completed"),
        ),
      )
      .limit(1),
    db
      .select({ id: leadActivities.id })
      .from(leadActivities)
      .where(
        and(
          eq(leadActivities.leadId, lead.id),
          eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID),
          eq(leadActivities.type, "note"),
          gte(leadActivities.createdAt, noteCutoff),
        ),
      )
      .limit(1),
    db
      .select({ id: tcfConsents.id })
      .from(tcfConsents)
      .where(
        and(
          eq(tcfConsents.leadId, lead.id),
          eq(tcfConsents.consentType, "call"),
          eq(tcfConsents.consented, false),
        ),
      )
      .limit(1),
    countConsecutiveNoAnswers(lead.id),
    isLeadReEnquired(lead.id, lead.createdAt),
  ]);

  return {
    now,
    createdAt: lead.createdAt,
    lastContactedAt: lead.lastContactedAt,
    leadSource: lead.leadSource,
    whatsappRepliedAt: lead.whatsappRepliedAt,
    hasAnsweredCall: answeredRow.length > 0,
    hasScheduledVisit: scheduledRow.length > 0,
    hasCompletedVisit: completedRow.length > 0,
    hasRecentNote: recentNoteRow.length > 0,
    isReEnquired,
    doNotCall: dncRow.length > 0,
    consecutiveNoAnswers,
  };
}

export async function getOrgScoringSettings(): Promise<Record<string, unknown>> {
  const [org] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, SINGLE_TENANT_ORG_ID))
    .limit(1);

  return (org?.settings as Record<string, unknown> | null) ?? {};
}

export async function computeLeadScoreForLead(
  leadId: string,
  now = new Date(),
): Promise<{ score: number; factors: ScoreFactor[] } | null> {
  const [lead] = await db
    .select({
      id: leads.id,
      createdAt: leads.createdAt,
      lastContactedAt: leads.lastContactedAt,
      leadSource: leads.leadSource,
      whatsappRepliedAt: leads.whatsappRepliedAt,
    })
    .from(leads)
    .where(
      and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId), isNull(leads.deletedAt)),
    )
    .limit(1);

  if (!lead) return null;

  const input = await gatherLeadScoringInput(lead, now);
  return calculateLeadScore(input);
}

export async function persistLeadScore(leadId: string, score: number, now = new Date()) {
  const settings = await getOrgScoringSettings();
  const enabled = isLeadScoringEnabled(settings);

  await db
    .update(leads)
    .set({
      score,
      scoreUpdatedAt: now,
      updatedAt: now,
      ...(enabled ? { temperature: scoreTier(score) } : {}),
    })
    .where(and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId)));
}

export async function getScoringConfig() {
  const settings = await getOrgScoringSettings();
  const enabled = isLeadScoringEnabled(settings);

  return {
    enabled,
    rules: DEFAULT_LEAD_SCORING_RULES,
    ruleLabels: LEAD_SCORING_RULE_LABELS,
    hotThreshold: HOT_LEAD_SCORE_THRESHOLD,
    warmThreshold: WARM_LEAD_SCORE_THRESHOLD,
    recalculateIntervalHours: 6,
  };
}

export async function getScoringStats() {
  const settings = await getOrgScoringSettings();
  const enabled = isLeadScoringEnabled(settings);
  if (!enabled) {
    return { enabled: false, totalScored: 0, hot: 0, warm: 0, cold: 0 };
  }

  const base = [
    eq(leads.orgId, SINGLE_TENANT_ORG_ID),
    isNull(leads.deletedAt),
    activeLeadStatusFilter(),
  ];

  const [[{ total }], [{ hot }], [{ warm }], [{ cold }]] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...base)),
    db
      .select({ hot: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...base, gte(leads.score, HOT_LEAD_SCORE_THRESHOLD))),
    db
      .select({ warm: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          ...base,
          gte(leads.score, WARM_LEAD_SCORE_THRESHOLD),
          sql`${leads.score} < ${HOT_LEAD_SCORE_THRESHOLD}`,
        ),
      ),
    db
      .select({ cold: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...base, sql`${leads.score} < ${WARM_LEAD_SCORE_THRESHOLD}`)),
  ]);

  return { enabled: true, totalScored: total, hot, warm, cold };
}

/** Hot-lead filter: score-based when scoring is on, else manual temperature. */
export async function resolveHotLeadCondition() {
  const settings = await getOrgScoringSettings();
  if (isLeadScoringEnabled(settings)) {
    return gte(leads.score, HOT_LEAD_SCORE_THRESHOLD);
  }
  return eq(leads.temperature, "hot");
}

export async function recalculateLeadScore(leadId: string, now = new Date()) {
  const settings = await getOrgScoringSettings();
  if (!isLeadScoringEnabled(settings)) {
    return null;
  }

  const result = await computeLeadScoreForLead(leadId, now);
  if (!result) return null;

  await persistLeadScore(leadId, result.score, now);
  return result;
}

export async function recalculateAllActiveLeadScores(now = new Date()) {
  const settings = await getOrgScoringSettings();
  if (!isLeadScoringEnabled(settings)) {
    return { updated: 0, checked: 0, skipped: true as const };
  }

  const activeLeads = await db
    .select({
      id: leads.id,
      createdAt: leads.createdAt,
      lastContactedAt: leads.lastContactedAt,
      leadSource: leads.leadSource,
      whatsappRepliedAt: leads.whatsappRepliedAt,
    })
    .from(leads)
    .where(
      and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), isNull(leads.deletedAt), activeLeadStatusFilter()),
    );

  let updated = 0;

  for (const lead of activeLeads) {
    const input = await gatherLeadScoringInput(lead, now);
    const { score } = calculateLeadScore(input);
    await persistLeadScore(lead.id, score, now);
    updated += 1;
  }

  return { updated, checked: activeLeads.length, skipped: false as const };
}

export async function listHotLeads(assignedTo?: string, limit = 50) {
  const settings = await getOrgScoringSettings();
  if (!isLeadScoringEnabled(settings)) {
    return [];
  }

  const filters = [
    eq(leads.orgId, SINGLE_TENANT_ORG_ID),
    isNull(leads.deletedAt),
    activeLeadStatusFilter(),
    gte(leads.score, HOT_LEAD_SCORE_THRESHOLD),
  ];

  if (assignedTo) {
    filters.push(eq(leads.assignedTo, assignedTo));
  }

  const rows = await db
    .select()
    .from(leads)
    .where(and(...filters))
    .orderBy(desc(leads.score), desc(leads.updatedAt))
    .limit(limit);

  return rows;
}

export async function getLeadScoreBreakdown(leadId: string, now = new Date()) {
  const settings = await getOrgScoringSettings();
  if (!isLeadScoringEnabled(settings)) {
    return null;
  }

  return computeLeadScoreForLead(leadId, now);
}

/** Batch-fetch scoring inputs for hot-leads preview (lighter than full breakdown). */
export async function getTopHotLeadsForAgent(agentId: string, limit = 5) {
  return listHotLeads(agentId, limit);
}
