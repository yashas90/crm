import { expandLeadSourceFilter } from "./leadSourceAliases.js";

export const HOT_LEAD_SCORE_THRESHOLD = 70;
export const WARM_LEAD_SCORE_THRESHOLD = 40;
export const MAX_LEAD_SCORE = 100;
export const MIN_LEAD_SCORE = 0;

export type LeadScoringRules = {
  answeredCall: number;
  whatsappReplied: number;
  siteVisitScheduled: number;
  siteVisitCompleted: number;
  recentNote: number;
  reEnquired: number;
  createdLast24h: number;
  created1to3Days: number;
  created4to7Days: number;
  noContact5Days: number;
  noContact10Days: number;
  doNotCall: number;
  noAnswerStreak3: number;
  sourcePaidAds: number;
  sourceReferral: number;
};

export const DEFAULT_LEAD_SCORING_RULES: LeadScoringRules = {
  answeredCall: 20,
  whatsappReplied: 15,
  siteVisitScheduled: 10,
  siteVisitCompleted: 20,
  recentNote: 5,
  reEnquired: 10,
  createdLast24h: 15,
  created1to3Days: 10,
  created4to7Days: 5,
  noContact5Days: -10,
  noContact10Days: -20,
  doNotCall: -15,
  noAnswerStreak3: -10,
  sourcePaidAds: 10,
  sourceReferral: 5,
};

export type ScoreFactor = {
  label: string;
  points: number;
};

export type LeadScoringInput = {
  now?: Date;
  createdAt: Date | string;
  lastContactedAt?: Date | string | null;
  leadSource?: string | null;
  whatsappRepliedAt?: Date | string | null;
  hasAnsweredCall: boolean;
  hasScheduledVisit: boolean;
  hasCompletedVisit: boolean;
  hasRecentNote: boolean;
  isReEnquired: boolean;
  doNotCall: boolean;
  consecutiveNoAnswers: number;
};

const MS_PER_DAY = 86_400_000;

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

function daysSinceContact(
  lastContactedAt: Date | string | null | undefined,
  createdAt: Date | string,
  now: Date,
): number {
  const anchor = lastContactedAt ? new Date(lastContactedAt) : new Date(createdAt);
  return Math.max(0, daysBetween(anchor, now));
}

function freshnessPoints(
  createdAt: Date | string,
  now: Date,
  rules: LeadScoringRules,
): ScoreFactor | null {
  const ageDays = daysBetween(new Date(createdAt), now);

  if (ageDays < 1) {
    return { label: "Lead created in last 24 hours", points: rules.createdLast24h };
  }
  if (ageDays <= 3) {
    return { label: "Lead created 1–3 days ago", points: rules.created1to3Days };
  }
  if (ageDays <= 7) {
    return { label: "Lead created 4–7 days ago", points: rules.created4to7Days };
  }
  return null;
}

function noContactPenalty(
  lastContactedAt: Date | string | null | undefined,
  createdAt: Date | string,
  now: Date,
  rules: LeadScoringRules,
): ScoreFactor | null {
  const days = daysSinceContact(lastContactedAt, createdAt, now);
  if (days >= 10) {
    return { label: "No contact in 10+ days", points: rules.noContact10Days };
  }
  if (days >= 5) {
    return { label: "No contact in 5+ days", points: rules.noContact5Days };
  }
  return null;
}

function sourceBonus(
  leadSource: string | null | undefined,
  rules: LeadScoringRules,
): ScoreFactor | null {
  if (!leadSource?.trim()) return null;

  const canonical = expandLeadSourceFilter(leadSource.trim())[0] ?? leadSource.trim();
  if (canonical === "Meta Ads" || canonical === "Google Ads") {
    return { label: `Source: ${canonical}`, points: rules.sourcePaidAds };
  }
  if (canonical === "Referral") {
    return { label: "Source: Referral", points: rules.sourceReferral };
  }
  return null;
}

export function clampLeadScore(score: number): number {
  return Math.max(MIN_LEAD_SCORE, Math.min(MAX_LEAD_SCORE, Math.round(score)));
}

export function scoreTier(score: number): "hot" | "warm" | "cold" {
  if (score >= HOT_LEAD_SCORE_THRESHOLD) return "hot";
  if (score >= WARM_LEAD_SCORE_THRESHOLD) return "warm";
  return "cold";
}

export function calculateLeadScore(
  input: LeadScoringInput,
  rules: LeadScoringRules = DEFAULT_LEAD_SCORING_RULES,
): { score: number; factors: ScoreFactor[] } {
  const now = input.now ?? new Date();
  const factors: ScoreFactor[] = [];

  if (input.hasAnsweredCall) {
    factors.push({ label: "Called and answered", points: rules.answeredCall });
  }
  if (input.whatsappRepliedAt) {
    factors.push({ label: "Replied to WhatsApp", points: rules.whatsappReplied });
  }
  if (input.hasScheduledVisit) {
    factors.push({ label: "Site visit scheduled", points: rules.siteVisitScheduled });
  }
  if (input.hasCompletedVisit) {
    factors.push({ label: "Site visit completed", points: rules.siteVisitCompleted });
  }
  if (input.hasRecentNote) {
    factors.push({ label: "Note added in last 3 days", points: rules.recentNote });
  }
  if (input.isReEnquired) {
    factors.push({ label: "Re-enquired", points: rules.reEnquired });
  }

  const freshness = freshnessPoints(input.createdAt, now, rules);
  if (freshness) factors.push(freshness);

  const contactPenalty = noContactPenalty(input.lastContactedAt, input.createdAt, now, rules);
  if (contactPenalty) factors.push(contactPenalty);

  if (input.doNotCall) {
    factors.push({ label: "Marked Do Not Call", points: rules.doNotCall });
  }
  if (input.consecutiveNoAnswers >= 3) {
    factors.push({ label: "No answer 3+ times in a row", points: rules.noAnswerStreak3 });
  }

  const source = sourceBonus(input.leadSource, rules);
  if (source) factors.push(source);

  const rawScore = factors.reduce((sum, factor) => sum + factor.points, 0);
  return { score: clampLeadScore(rawScore), factors };
}

export function isLeadScoringEnabled(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  const value = settings?.leadScoringEnabled;
  if (value === false || value === "false") return false;
  return true;
}

export const LEAD_SCORING_RULE_LABELS: { key: keyof LeadScoringRules; label: string }[] = [
  { key: "answeredCall", label: "Called and answered at least once" },
  { key: "whatsappReplied", label: "Replied to WhatsApp" },
  { key: "siteVisitScheduled", label: "Site visit scheduled" },
  { key: "siteVisitCompleted", label: "Site visit completed" },
  { key: "recentNote", label: "Note added in last 3 days" },
  { key: "reEnquired", label: "Re-enquired after lost" },
  { key: "createdLast24h", label: "Lead created in last 24 hours" },
  { key: "created1to3Days", label: "Created 1–3 days ago" },
  { key: "created4to7Days", label: "Created 4–7 days ago" },
  { key: "noContact5Days", label: "No contact in 5+ days" },
  { key: "noContact10Days", label: "No contact in 10+ days" },
  { key: "doNotCall", label: "Marked Do Not Call (TCF)" },
  { key: "noAnswerStreak3", label: "No answer 3+ times in a row" },
  { key: "sourcePaidAds", label: "Source: Meta Ads or Google Ads" },
  { key: "sourceReferral", label: "Source: Referral" },
];
