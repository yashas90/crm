import { getIstDateKey } from "@propninja/types/ist";
import { INCENTIVE_BANDS, type IncentiveBand, isIncentiveBand } from "./incentiveMath.js";

/** 05:00–11:59 morning, 12:00–16:59 afternoon, 17:00–20:29 evening, otherwise welcome back. */
export function greetingForIstClock(hour: number, minute: number): string {
  const mins = hour * 60 + minute;
  if (mins >= 5 * 60 && mins <= 11 * 60 + 59) return "Good morning";
  if (mins >= 12 * 60 && mins <= 16 * 60 + 59) return "Good afternoon";
  if (mins >= 17 * 60 && mins <= 20 * 60 + 29) return "Good evening";
  return "Welcome back";
}

/** Days left in the IST month, including today. */
export function daysRemainingInIstMonth(now = new Date()): number {
  const [year, month, day] = getIstDateKey(now).split("-").map(Number);
  const last = new Date(Date.UTC(year ?? 1970, month ?? 1, 0)).getUTCDate();
  return Math.max(1, last - (day ?? 1) + 1);
}

/** Rupees still required, split across the days left in the month (today included). */
export function dailyNeeded(target: number, achieved: number, daysRemaining: number): number {
  const gap = Math.max(0, target - achieved);
  const days = daysRemaining > 0 ? daysRemaining : 1;
  return Math.round((gap / days) * 100) / 100;
}

/** Collected NR must be strictly above a real eligibility target. */
export function isIncentiveUnlocked(collectedNr: number, eligibilityTarget: number): boolean {
  if (eligibilityTarget <= 0) return false;
  return collectedNr > eligibilityTarget;
}

export function aboveTargetPercent(band: string | null | undefined): number {
  const key: IncentiveBand = isIncentiveBand(band) ? band : "NE";
  return Math.round(INCENTIVE_BANDS[key].aboveRate * 100);
}

/**
 * Prefer monthlyBasic × band multiplier so the brief matches incentive approvals.
 * A stored agent_targets revenue figure is used only when there is no band.
 */
export function resolveMonthlyTarget(input: {
  monthlyBasic: number;
  band: string | null | undefined;
  storedRevenueTarget: number | null | undefined;
}): { amount: number; source: "incentive" | "agent_target" | "none"; band: IncentiveBand | null } {
  if (isIncentiveBand(input.band)) {
    const amount =
      Math.round(Math.max(0, input.monthlyBasic) * INCENTIVE_BANDS[input.band].multiplier * 100) /
      100;
    return { amount, source: "incentive", band: input.band };
  }
  const stored = Number(input.storedRevenueTarget ?? 0);
  if (Number.isFinite(stored) && stored > 0) {
    return { amount: Math.round(stored * 100) / 100, source: "agent_target", band: null };
  }
  return { amount: 0, source: "none", band: null };
}

export function briefFirstName(
  firstName: string | null | undefined,
  name: string | null | undefined,
): string {
  const explicit = firstName?.trim();
  if (explicit) return explicit;
  const token = name?.trim().split(/\s+/)[0];
  return token || "there";
}

export function istDayOfYear(now = new Date()): number {
  const [year, month, day] = getIstDateKey(now).split("-").map(Number);
  const start = Date.UTC(year ?? 1970, 0, 1);
  const current = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  return Math.floor((current - start) / 86_400_000) + 1;
}

/** Original lines. The index is stable for an IST calendar day. */
export const MORNING_QUOTES = [
  "The next site visit is already on your calendar. Confirm it before the day gets away.",
  "A callback you keep is worth more than a new number you chase.",
  "Buyers decide with the person who showed up first and stayed clear.",
  "Ask for the visit while the conversation is still warm.",
  "One honest follow-up beats five forgotten promises.",
  "Know the unit, the price, and the next step before you dial.",
  "The pipeline moves when you name a time, not when you say soon.",
  "Listen for the budget. Then talk about the home that fits it.",
  "A no today is useful. Write it down and move to the next call.",
  "Site visits close more homes than perfect pitches.",
  "Your morning list is the day's work. Start at the top.",
  "People buy from the agent who remembers the last conversation.",
  "If the lead is hot, the follow-up is today.",
  "Price objections get smaller when the home is right.",
  "Call the overdue names before you open a new list.",
  "A clear next step is a sale that has somewhere to go.",
  "Treat every callback time as an appointment you set yourself.",
  "The best inventory story is the one that matches their family.",
  "Rank is a result. Calls are the work.",
  "Collect the requirement, then show only what fits.",
  "Silence after a site visit is a follow-up, not a rejection.",
  "Write the note while the call is still in your head.",
  "A short call with a date beats a long call with no plan.",
  "Neighbours close when you know the project better than the brochure.",
  "The target is a run of honest conversations. Revenue follows that.",
  "Show up on time for the visit. Trust starts at the gate.",
  "Ask who else decides. Then include them.",
  "Warm leads go cold when the next call has no owner.",
  "End every call with a time you both can see.",
  "The agent who follows through is the one they recommend.",
] as const;

export function quoteForIstDate(now = new Date()): { text: string; dayOfYear: number } {
  const dayOfYear = istDayOfYear(now);
  const text = MORNING_QUOTES[(dayOfYear - 1) % MORNING_QUOTES.length] ?? MORNING_QUOTES[0];
  return { text, dayOfYear };
}

export function formatIstBriefDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
}
