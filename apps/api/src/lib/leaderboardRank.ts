import { addDaysToDateKey, getIstDateKey, istWallClockToDate } from "@propninja/types/ist";
import { formatINR } from "@propninja/types/money";
import { INCENTIVE_BANDS, type IncentiveBand, isIncentiveBand } from "./incentiveMath.js";

export const BADGE_TYPES = [
  "first_deal",
  "five_deals",
  "ten_deals",
  "target_hit",
  "overachiever",
  "top_gun",
  "streak_3",
  "streak_7",
  "nr_10l",
  "nr_25l",
  "nr_50l",
] as const;

export type BadgeType = (typeof BADGE_TYPES)[number];

/** ₹10L = 1,000,000; ₹25L = 2,500,000; ₹50L = 5,000,000. */
export const NR_BADGE_RUPEES = {
  nr_10l: 1_000_000,
  nr_25l: 2_500_000,
  nr_50l: 5_000_000,
} as const;

export const BADGE_META: Record<BadgeType, { name: string; tooltip: string }> = {
  first_deal: {
    name: "First Deal",
    tooltip: "First Deal — you closed your first collected deal.",
  },
  five_deals: {
    name: "Five Deals",
    tooltip: "Five Deals — 5 collected deals in a month.",
  },
  ten_deals: {
    name: "Ten Deals",
    tooltip: "Ten Deals — 10 collected deals in a month.",
  },
  target_hit: {
    name: "Target Hit",
    tooltip: "Target Hit — reached 100% of the monthly target.",
  },
  overachiever: {
    name: "Overachiever",
    tooltip: "Overachiever — reached 150% of the monthly target.",
  },
  top_gun: {
    name: "Top Gun",
    tooltip: "Top Gun — rank #1 for the month across the company.",
  },
  streak_3: {
    name: "3-Day Streak",
    tooltip: "3-Day Streak — a collected deal on 3 consecutive days.",
  },
  streak_7: {
    name: "7-Day Streak",
    tooltip: "7-Day Streak — a collected deal on 7 consecutive days.",
  },
  nr_10l: {
    name: "₹10L",
    tooltip: "₹10L — ₹10 lakh net revenue in a month.",
  },
  nr_25l: {
    name: "₹25L",
    tooltip: "₹25L — ₹25 lakh net revenue in a month.",
  },
  nr_50l: {
    name: "₹50L",
    tooltip: "₹50L — ₹50 lakh net revenue in a month.",
  },
};

export const FORBIDDEN_LEADERBOARD_KEYS = [
  "monthlyBasic",
  "monthlySalary",
  "monthly_basic",
  "monthly_salary",
  "salary",
  "eligibilityTarget",
  "eligibility_target",
  "targetAmount",
  "targetRupees",
  "target_rupees",
  "targetInr",
] as const;

export type LeaderboardRole = "admin" | "manager" | "agent";

export type LeaderboardDeal = {
  id: string;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  invoiceStatus: "not_raised" | "raised" | "collected";
  netRevenue: number;
  closedOn: string | null;
  shares: { userId: string; sharePercent: number }[];
};

export type LeaderboardPerson = {
  userId: string;
  name: string;
  role: LeaderboardRole;
  designation: string | null;
  band: IncentiveBand | null;
  /** Internal only. Never copied onto the API payload. */
  monthlyBasic: number;
  reportingToId: string | null;
  department: string | null;
  showLeaderboardAvatar: boolean;
};

export type RankSnapshot = {
  userId: string;
  periodKey: string;
  scopeKey: string;
  rank: number;
  snapshotDate: string;
};

export type StoredBadge = {
  agentId: string;
  type: BadgeType;
  earnedAt: string;
  periodMonth: number | null;
  periodYear: number | null;
  periodQuarter: number | null;
};

export type AnnouncementRow = {
  id: string;
  kind: "announcement" | "challenge";
  body: string;
  active: boolean;
  createdAt: string;
};

export type LeaderboardQuery = {
  period: "month" | "quarter" | "year" | "all";
  scope: "team" | "all" | "branch";
  teamId?: string;
  month?: number;
  year?: number;
  quarter?: number;
  quarterYear?: number;
};

export type BadgeAward = {
  agentId: string;
  type: BadgeType;
  periodMonth: number | null;
  periodYear: number | null;
  periodQuarter: number | null;
};

export type LeaderboardBadge = { type: BadgeType; name: string; tooltip: string };

export type LeaderboardRow = {
  rank: number;
  previousRank: number | null;
  trend: "up" | "down" | "flat";
  trendDelta: number;
  userId: string | null;
  agentName: string;
  designation: string | null;
  grade: string | null;
  teamName: string;
  avatarUrl: null;
  initials: string;
  totalNr: number;
  targetAchievementPercent: number;
  dealsClosed: number;
  unitsClosed: number;
  nrThisWeek: number;
  nrLastWeek: number;
  streakDays: number;
  badges: LeaderboardBadge[];
  gapToNext: number;
  gapToTop3: number;
  nameAbove: string | null;
  jumpToRank: number | null;
  personalBest: boolean;
  masked: boolean;
};

export type LeaderboardPayload = {
  period: LeaderboardQuery["period"];
  scope: LeaderboardQuery["scope"];
  periodKey: string;
  scopeKey: string;
  generatedAt: string;
  countdown: { days: number; hours: number };
  announcement: { id: string; body: string } | null;
  challenge: { id: string; body: string } | null;
  milestone: { message: string } | null;
  showTeamTab: boolean;
  personalBest: boolean;
  showLeaderboardAvatar: boolean;
  podium: LeaderboardRow[];
  rows: LeaderboardRow[];
  entries: LeaderboardRow[];
  me: LeaderboardRow;
};

export type HallOfFamePayload = {
  bestMonth: { agentName: string; month: string; totalNr: number; masked: boolean } | null;
  mostDeals: { agentName: string; month: string; dealsClosed: number; masked: boolean } | null;
  longestStreak: { agentName: string; days: number; masked: boolean } | null;
  mostConsistent: { agentName: string; months: number; masked: boolean } | null;
};

export type TeamCard = {
  managerId: string;
  managerName: string;
  totalNr: number;
  teamTarget: number;
  achievementPercent: number;
  membersAboveTarget: number;
  memberCount: number;
  topPerformerName: string | null;
  topPerformerNr: number | null;
};

export type TeamsPayload = {
  teams: TeamCard[];
  myTeam: LeaderboardRow[];
};

export type Standing = {
  userId: string;
  rank: number;
  periodKey: string;
  scopeKey: string;
};

type PeriodWindow = {
  kind: LeaderboardQuery["period"];
  key: string;
  start: string | null;
  end: string | null;
  year: number;
  month: number;
  quarter: number;
};

type Score = {
  person: LeaderboardPerson;
  totalNr: number;
  dealsClosed: number;
  unitsClosed: number;
  firstDealOn: string | null;
  nrThisWeek: number;
  nrLastWeek: number;
  streakDays: number;
  achievementPercent: number;
  personalBest: boolean;
};

const MONEY = (value: number) => Math.round(value * 100) / 100;

export function countedDeal(deal: LeaderboardDeal) {
  return deal.status === "approved" && deal.invoiceStatus === "collected";
}

export function badgeEarnedMessage(type: BadgeType) {
  const name = BADGE_META[type].name;
  if (type === "top_gun") {
    return `🏆 You earned the '${name}' badge! You're #1 this month!`;
  }
  return `🏆 You earned the '${name}' badge!`;
}

export function dealClosedMessage(agentName: string, dealNr: number, rank: number) {
  return `🔥 ${agentName} just closed a ${formatINR(dealNr)} deal!\nNew ranking: #${rank}`;
}

export function monthEndMessage(rank: number, nr: number, aboveRank: number) {
  return `📊 Month ends tonight!\nYou're ranked #${rank} with ${formatINR(nr)}\nClose 1 more deal to reach #${aboveRank}!`;
}

export function monthCountdown(now: Date) {
  const key = getIstDateKey(now);
  const [year, month] = key.split("-").map(Number);
  const next =
    month === 12
      ? `${(year ?? 0) + 1}-01-01`
      : `${year}-${String((month ?? 1) + 1).padStart(2, "0")}-01`;
  const end = istWallClockToDate(next, 0, 0);
  const hoursTotal = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 3_600_000));
  return { days: Math.floor(hoursTotal / 24), hours: hoursTotal % 24 };
}

export function isLastIstDay(now: Date) {
  const key = getIstDateKey(now);
  const [year, month, day] = key.split("-").map(Number);
  const last = new Date(Date.UTC(year ?? 1970, month ?? 1, 0)).getUTCDate();
  return day === last;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function quarterOf(month: number) {
  return Math.floor((month - 1) / 3) + 1;
}

function monthlyTarget(person: LeaderboardPerson) {
  const band = person.band && isIncentiveBand(person.band) ? person.band : "NE";
  return MONEY(Math.max(0, person.monthlyBasic) * INCENTIVE_BANDS[band].multiplier);
}

function achievement(nr: number, target: number) {
  if (target <= 0) return 0;
  return Math.round((nr / target) * 1000) / 10;
}

function sharePercent(deal: LeaderboardDeal, userId: string) {
  return deal.shares.find((share) => share.userId === userId)?.sharePercent ?? 0;
}

function attributed(deal: LeaderboardDeal, userId: string) {
  const pct = sharePercent(deal, userId);
  if (pct <= 0) return 0;
  return MONEY((Math.max(0, deal.netRevenue) * pct) / 100);
}

function inWindow(date: string | null, window: PeriodWindow) {
  if (!date) return false;
  if (!window.start || !window.end) return true;
  return date >= window.start && date <= window.end;
}

function resolvePeriod(query: LeaderboardQuery, now: Date): PeriodWindow {
  const today = getIstDateKey(now);
  const [ty, tm] = today.split("-").map(Number);
  const year = query.year ?? ty ?? 1970;
  const month = query.month ?? tm ?? 1;
  if (query.period === "all") {
    return {
      kind: "all",
      key: "all",
      start: null,
      end: null,
      year: ty ?? year,
      month: tm ?? month,
      quarter: quarterOf(tm ?? month),
    };
  }
  if (query.period === "year") {
    const y = query.year ?? ty ?? year;
    return {
      kind: "year",
      key: `year:${y}`,
      start: `${y}-01-01`,
      end: `${y}-12-31`,
      year: y,
      month: tm ?? month,
      quarter: quarterOf(tm ?? month),
    };
  }
  if (query.period === "quarter") {
    const y = query.quarterYear ?? ty ?? year;
    const q = query.quarter ?? quarterOf(tm ?? month);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const endDay = new Date(Date.UTC(y, endMonth, 0)).getUTCDate();
    return {
      kind: "quarter",
      key: `quarter:${y}-Q${q}`,
      start: `${y}-${pad(startMonth)}-01`,
      end: `${y}-${pad(endMonth)}-${pad(endDay)}`,
      year: y,
      month: startMonth,
      quarter: q,
    };
  }
  const y = query.year ?? ty ?? year;
  const m = query.month ?? tm ?? month;
  const endDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    kind: "month",
    key: `month:${y}-${pad(m)}`,
    start: `${y}-${pad(m)}-01`,
    end: `${y}-${pad(m)}-${pad(endDay)}`,
    year: y,
    month: m,
    quarter: quarterOf(m),
  };
}

function mondayOf(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  const dow = utc.getUTCDay();
  const delta = dow === 0 ? 6 : dow - 1;
  utc.setUTCDate(utc.getUTCDate() - delta);
  return utc.toISOString().slice(0, 10);
}

function squadLeadId(person: LeaderboardPerson) {
  if (person.role === "agent") return person.reportingToId ?? person.userId;
  return person.userId;
}

function inSquad(person: LeaderboardPerson, leadId: string) {
  return person.userId === leadId || person.reportingToId === leadId;
}

function sameSquad(a: LeaderboardPerson, b: LeaderboardPerson) {
  return squadLeadId(a) === squadLeadId(b);
}

function seesEveryName(viewer: LeaderboardPerson) {
  return viewer.role === "admin" || viewer.band === "N3";
}

function restrictedManager(viewer: LeaderboardPerson) {
  return viewer.role === "manager" && viewer.band !== "N3";
}

/**
 * My Branch has no branch entity. It means everyone in the same users.department,
 * or the viewer's own team when department is null.
 */
function inScope(
  person: LeaderboardPerson,
  viewer: LeaderboardPerson,
  scope: LeaderboardQuery["scope"],
) {
  if (scope === "all") return true;
  if (scope === "team") return sameSquad(person, viewer);
  if (!viewer.department) return sameSquad(person, viewer);
  return person.department === viewer.department;
}

function viewerPerson(
  people: LeaderboardPerson[],
  viewerId: string,
  viewerRole: LeaderboardRole,
): LeaderboardPerson {
  const found = people.find((person) => person.userId === viewerId);
  if (found) return { ...found, role: viewerRole };
  return {
    userId: viewerId,
    name: "You",
    role: viewerRole,
    designation: null,
    band: null,
    monthlyBasic: 0,
    reportingToId: null,
    department: null,
    showLeaderboardAvatar: false,
  };
}

function scopeKeyFor(viewer: LeaderboardPerson, query: LeaderboardQuery, exportMode: boolean) {
  const scope = !exportMode && restrictedManager(viewer) ? "team" : query.scope;
  if (scope === "all") return "all";
  if (scope === "branch") {
    if (!viewer.department) return `team:${squadLeadId(viewer)}`;
    return `branch:${viewer.department}`;
  }
  const lead =
    query.teamId && (viewer.role === "admin" || viewer.band === "N3")
      ? query.teamId
      : squadLeadId(viewer);
  return `team:${lead}`;
}

function poolFor(
  people: LeaderboardPerson[],
  viewer: LeaderboardPerson,
  query: LeaderboardQuery,
  exportMode: boolean,
) {
  const focusTeam =
    query.scope === "team" &&
    query.teamId &&
    (exportMode || viewer.role === "admin" || viewer.band === "N3")
      ? query.teamId
      : null;
  let list = people.filter((person) => {
    if (focusTeam) return inSquad(person, focusTeam);
    return inScope(person, viewer, query.scope);
  });
  if (!exportMode && restrictedManager(viewer)) {
    list = list.filter((person) => sameSquad(person, viewer));
  }
  if (!list.some((person) => person.userId === viewer.userId)) {
    const self = people.find((person) => person.userId === viewer.userId);
    if (self) list = [...list, self];
  }
  return list;
}

function monthKeyOf(date: string) {
  return date.slice(0, 7);
}

function monthsBetween(startMonth: string, endMonth: string) {
  const [ys, ms] = startMonth.split("-").map(Number);
  const [ye, me] = endMonth.split("-").map(Number);
  return Math.max(1, (ye! - ys!) * 12 + (me! - ms!) + 1);
}

function personDeals(person: LeaderboardPerson, deals: LeaderboardDeal[]) {
  return deals.filter((deal) => countedDeal(deal) && sharePercent(deal, person.userId) > 0);
}

function scorePerson(
  person: LeaderboardPerson,
  deals: LeaderboardDeal[],
  window: PeriodWindow,
  now: Date,
): Score {
  const today = getIstDateKey(now);
  const weekStart = mondayOf(today);
  const lastWeekStart = addDaysToDateKey(weekStart, -7);
  const lastWeekEnd = addDaysToDateKey(weekStart, -1);
  const mine = personDeals(person, deals);
  let totalNr = 0;
  let dealsClosed = 0;
  let unitsClosed = 0;
  let firstDealOn: string | null = null;
  let nrThisWeek = 0;
  let nrLastWeek = 0;
  const monthNr = new Map<string, number>();
  const days: string[] = [];
  for (const deal of mine) {
    const amount = attributed(deal, person.userId);
    const on = deal.closedOn;
    if (on) {
      days.push(on);
      const mk = monthKeyOf(on);
      monthNr.set(mk, MONEY((monthNr.get(mk) ?? 0) + amount));
      if (on >= weekStart && on <= today) nrThisWeek = MONEY(nrThisWeek + amount);
      if (on >= lastWeekStart && on <= lastWeekEnd) nrLastWeek = MONEY(nrLastWeek + amount);
    }
    if (!inWindow(on, window)) continue;
    totalNr = MONEY(totalNr + amount);
    dealsClosed += 1;
    unitsClosed = MONEY(unitsClosed + sharePercent(deal, person.userId) / 100);
    if (on && (!firstDealOn || on < firstDealOn)) firstDealOn = on;
  }
  const monthly = monthlyTarget(person);
  let span = 1;
  if (window.kind === "quarter") span = 3;
  else if (window.kind === "year") span = 12;
  else if (window.kind === "all") {
    const months = [...monthNr.keys()].sort();
    span = months.length ? monthsBetween(months[0]!, today.slice(0, 7)) : 1;
  }
  const target = MONEY(monthly * span);
  let bestPrior = 0;
  if (window.start) {
    const cutoff = window.start.slice(0, 7);
    for (const [month, nr] of monthNr) {
      if (month < cutoff) bestPrior = Math.max(bestPrior, nr);
    }
  }
  return {
    person,
    totalNr,
    dealsClosed,
    unitsClosed,
    firstDealOn,
    nrThisWeek: MONEY(nrThisWeek),
    nrLastWeek: MONEY(nrLastWeek),
    streakDays: currentStreak(days, today),
    achievementPercent: achievement(totalNr, target),
    personalBest: totalNr > bestPrior && totalNr > 0,
  };
}

function currentStreak(days: string[], today: string) {
  const runs = streakRuns(days);
  if (runs.length === 0) return 0;
  const last = runs[runs.length - 1]!;
  const yesterday = addDaysToDateKey(today, -1);
  if (last.end === today || last.end === yesterday) return last.length;
  return 0;
}

function streakRuns(days: string[]) {
  const unique = [...new Set(days.filter(Boolean))].sort();
  const runs: { end: string; length: number }[] = [];
  let start = 0;
  for (let i = 1; i <= unique.length; i++) {
    const prev = unique[i - 1];
    const curr = unique[i];
    const consecutive = curr != null && prev != null && addDaysToDateKey(prev, 1) === curr;
    if (!consecutive && prev) {
      runs.push({ end: prev, length: i - start });
      start = i;
    }
  }
  return runs;
}

function longestStreak(days: string[]) {
  const runs = streakRuns(days);
  return runs.reduce((max, run) => Math.max(max, run.length), 0);
}

function compareScores(a: Score, b: Score) {
  if (b.totalNr !== a.totalNr) return b.totalNr - a.totalNr;
  if (b.dealsClosed !== a.dealsClosed) return b.dealsClosed - a.dealsClosed;
  const af = a.firstDealOn ?? "9999-99-99";
  const bf = b.firstDealOn ?? "9999-99-99";
  if (af !== bf) return af < bf ? -1 : 1;
  return a.person.name.localeCompare(b.person.name);
}

function rupeesToBeat(ahead: number, mine: number) {
  if (mine > ahead) return 0;
  return Math.floor(ahead - mine) + 1;
}

function initialsOf(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

function managerLabel(person: LeaderboardPerson, people: LeaderboardPerson[]) {
  if (person.reportingToId) {
    return people.find((row) => row.userId === person.reportingToId)?.name ?? "their manager";
  }
  if (person.role === "manager" || person.role === "admin") return person.name;
  return "another team";
}

function maskLabel(
  person: LeaderboardPerson,
  people: LeaderboardPerson[],
  viewer: LeaderboardPerson,
) {
  const lead = managerLabel(person, people);
  if (lead === "another team") return "Agent from another team";
  if (viewer.role === "agent") return `Agent from ${lead}'s team`;
  return `${lead}'s team`;
}

function badgeVisible(award: BadgeAward, window: PeriodWindow) {
  if (award.periodYear == null && award.periodMonth == null) return true;
  if (window.kind === "all") return true;
  if (window.kind === "year") return award.periodYear === window.year;
  if (window.kind === "quarter") {
    return award.periodYear === window.year && award.periodQuarter === window.quarter;
  }
  return award.periodYear === window.year && award.periodMonth === window.month;
}

function toPublicBadge(type: BadgeType): LeaderboardBadge {
  return { type, name: BADGE_META[type].name, tooltip: BADGE_META[type].tooltip };
}

export function evaluateBadgeAwards(
  people: LeaderboardPerson[],
  deals: LeaderboardDeal[],
  now: Date,
): BadgeAward[] {
  const awards: BadgeAward[] = [];
  const seen = new Set<string>();
  const push = (award: BadgeAward) => {
    const key = [
      award.agentId,
      award.type,
      award.periodYear ?? "x",
      award.periodMonth ?? "x",
      award.periodQuarter ?? "x",
    ].join("|");
    if (seen.has(key)) return;
    seen.add(key);
    awards.push(award);
  };

  const monthKeys = new Set<string>([getIstDateKey(now).slice(0, 7)]);
  for (const deal of deals) {
    if (countedDeal(deal) && deal.closedOn) monthKeys.add(monthKeyOf(deal.closedOn));
  }

  for (const monthKey of monthKeys) {
    const [year, month] = monthKey.split("-").map(Number);
    const window = resolvePeriod({ period: "month", scope: "all", year, month }, now);
    const ranked = people
      .map((person) => scorePerson(person, deals, window, now))
      .sort(compareScores);
    ranked.forEach((score, index) => {
      const period = {
        periodMonth: month ?? null,
        periodYear: year ?? null,
        periodQuarter: quarterOf(month ?? 1),
      };
      const id = score.person.userId;
      if (score.dealsClosed >= 5) push({ agentId: id, type: "five_deals", ...period });
      if (score.dealsClosed >= 10) push({ agentId: id, type: "ten_deals", ...period });
      const target = monthlyTarget(score.person);
      if (target > 0 && score.totalNr >= target) {
        push({ agentId: id, type: "target_hit", ...period });
      }
      if (target > 0 && score.totalNr >= target * 1.5) {
        push({ agentId: id, type: "overachiever", ...period });
      }
      if (index === 0 && score.totalNr > 0) push({ agentId: id, type: "top_gun", ...period });
      if (score.totalNr >= NR_BADGE_RUPEES.nr_10l) push({ agentId: id, type: "nr_10l", ...period });
      if (score.totalNr >= NR_BADGE_RUPEES.nr_25l) push({ agentId: id, type: "nr_25l", ...period });
      if (score.totalNr >= NR_BADGE_RUPEES.nr_50l) push({ agentId: id, type: "nr_50l", ...period });
    });
  }

  for (const person of people) {
    const mine = personDeals(person, deals);
    if (mine.length > 0) {
      push({
        agentId: person.userId,
        type: "first_deal",
        periodMonth: null,
        periodYear: null,
        periodQuarter: null,
      });
    }
    const runs = streakRuns(mine.map((deal) => deal.closedOn ?? "").filter(Boolean));
    for (const run of runs) {
      const [year, month] = run.end.split("-").map(Number);
      const period = {
        periodMonth: month ?? null,
        periodYear: year ?? null,
        periodQuarter: quarterOf(month ?? 1),
      };
      if (run.length >= 3) push({ agentId: person.userId, type: "streak_3", ...period });
      if (run.length >= 7) push({ agentId: person.userId, type: "streak_7", ...period });
    }
  }
  return awards;
}

type BuildInput = {
  people: LeaderboardPerson[];
  deals: LeaderboardDeal[];
  snapshots: RankSnapshot[];
  announcements: AnnouncementRow[];
  viewerId: string;
  viewerRole: LeaderboardRole;
  query: LeaderboardQuery;
  now: Date;
  freshBadges?: { agentId: string; type: BadgeType }[];
  exportMode?: boolean;
};

function rankedScores(input: BuildInput) {
  const viewer = viewerPerson(input.people, input.viewerId, input.viewerRole);
  const window = resolvePeriod(input.query, input.now);
  const exportMode = input.exportMode === true;
  const scopeKey = scopeKeyFor(viewer, input.query, exportMode);
  const pool = poolFor(input.people, viewer, input.query, exportMode);
  const scores = pool
    .map((person) => scorePerson(person, input.deals, window, input.now))
    .sort(compareScores);
  return { viewer, window, scopeKey, scores, exportMode };
}

export function computeStandings(input: BuildInput): Standing[] {
  const { scores, window, scopeKey } = rankedScores(input);
  return scores.map((score, index) => ({
    userId: score.person.userId,
    rank: index + 1,
    periodKey: window.key,
    scopeKey,
  }));
}

function trendOf(previous: number | null, rank: number) {
  if (previous == null || previous === rank) {
    return { trend: "flat" as const, trendDelta: 0, previousRank: previous };
  }
  if (previous > rank) {
    return { trend: "up" as const, trendDelta: previous - rank, previousRank: previous };
  }
  return { trend: "down" as const, trendDelta: rank - previous, previousRank: previous };
}

function emptyRow(viewer: LeaderboardPerson, rank: number): LeaderboardRow {
  return {
    rank,
    previousRank: null,
    trend: "flat",
    trendDelta: 0,
    userId: viewer.userId,
    agentName: viewer.name,
    designation: viewer.designation,
    grade: viewer.band,
    teamName: viewer.name,
    avatarUrl: null,
    initials: initialsOf(viewer.name),
    totalNr: 0,
    targetAchievementPercent: 0,
    dealsClosed: 0,
    unitsClosed: 0,
    nrThisWeek: 0,
    nrLastWeek: 0,
    streakDays: 0,
    badges: [],
    gapToNext: 0,
    gapToTop3: 0,
    nameAbove: null,
    jumpToRank: null,
    personalBest: false,
    masked: false,
  };
}

function latestActive(rows: AnnouncementRow[], kind: AnnouncementRow["kind"]) {
  const match = rows
    .filter((row) => row.active && row.kind === kind)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  return match ? { id: match.id, body: match.body } : null;
}

export function assembleLeaderboard(input: BuildInput): LeaderboardPayload {
  const built = rankedScores(input);
  const { viewer, window, scopeKey, scores, exportMode } = built;
  const awards = evaluateBadgeAwards(input.people, input.deals, input.now);
  const yesterday = addDaysToDateKey(getIstDateKey(input.now), -1);
  const previous = new Map(
    input.snapshots
      .filter(
        (row) =>
          row.snapshotDate === yesterday &&
          row.periodKey === window.key &&
          row.scopeKey === scopeKey,
      )
      .map((row) => [row.userId, row.rank]),
  );
  const third = scores[2];
  const entries = scores.map((score, index) => {
    const rank = index + 1;
    const above = index > 0 ? scores[index - 1] : null;
    const vis = visibility(viewer, score.person, exportMode);
    const masked = vis === "mask";
    const displayName = masked ? maskLabel(score.person, input.people, viewer) : score.person.name;
    const badges = awards
      .filter((award) => award.agentId === score.person.userId && badgeVisible(award, window))
      .map((award) => toPublicBadge(award.type));
    const uniqueBadges = [...new Map(badges.map((badge) => [badge.type, badge])).values()];
    const moved = trendOf(previous.get(score.person.userId) ?? null, rank);
    return {
      rank,
      previousRank: moved.previousRank,
      trend: moved.trend,
      trendDelta: moved.trendDelta,
      userId: masked ? null : score.person.userId,
      agentName: displayName,
      designation: masked ? null : score.person.designation,
      grade: masked ? null : score.person.band,
      teamName: managerLabel(score.person, input.people),
      avatarUrl: null,
      initials: initialsOf(displayName),
      totalNr: score.totalNr,
      targetAchievementPercent: score.achievementPercent,
      dealsClosed: score.dealsClosed,
      unitsClosed: score.unitsClosed,
      nrThisWeek: score.nrThisWeek,
      nrLastWeek: score.nrLastWeek,
      streakDays: score.streakDays,
      badges: uniqueBadges,
      gapToNext: above ? rupeesToBeat(above.totalNr, score.totalNr) : 0,
      gapToTop3: rank <= 3 || !third ? 0 : rupeesToBeat(third.totalNr, score.totalNr),
      nameAbove: above
        ? visibility(viewer, above.person, exportMode) === "full"
          ? above.person.name
          : maskLabel(above.person, input.people, viewer)
        : null,
      jumpToRank: above ? rank - 1 : null,
      personalBest: score.personalBest,
      masked,
    } satisfies LeaderboardRow;
  });
  const visible = entries.filter((_, index) => {
    const person = scores[index]!.person;
    return visibility(viewer, person, exportMode) !== "hide";
  });
  const me =
    visible.find((row) => row.userId === viewer.userId) ??
    entries.find((row) => row.userId === viewer.userId) ??
    emptyRow(viewer, visible.length + 1);
  const fresh = (input.freshBadges ?? []).filter((badge) => badge.agentId === viewer.userId);
  const milestoneType = fresh.find((badge) => badge.type === "top_gun")?.type ?? fresh[0]?.type;
  const payload: LeaderboardPayload = {
    period: input.query.period,
    scope: input.query.scope,
    periodKey: window.key,
    scopeKey,
    generatedAt: input.now.toISOString(),
    countdown: monthCountdown(input.now),
    announcement: latestActive(input.announcements, "announcement"),
    challenge: latestActive(input.announcements, "challenge"),
    milestone: milestoneType ? { message: badgeEarnedMessage(milestoneType) } : null,
    showTeamTab:
      viewer.role === "admin" ||
      (viewer.role === "manager" && (viewer.band === "N2" || viewer.band === "N3")),
    personalBest: me.personalBest,
    showLeaderboardAvatar: viewer.showLeaderboardAvatar,
    podium: visible.filter((row) => row.rank <= 3),
    rows: visible.filter((row) => row.rank > 3),
    entries: visible,
    me,
  };
  return stripSensitive(payload);
}

function visibility(
  viewer: LeaderboardPerson,
  person: LeaderboardPerson,
  exportMode: boolean,
): "full" | "mask" | "hide" {
  if (exportMode || person.userId === viewer.userId || seesEveryName(viewer)) return "full";
  if (sameSquad(person, viewer)) return "full";
  if (viewer.role === "manager") return "hide";
  return "mask";
}

export function buildHallOfFame(input: BuildInput): HallOfFamePayload {
  const viewer = viewerPerson(input.people, input.viewerId, input.viewerRole);
  const candidates =
    viewer.role === "agent" || seesEveryName(viewer)
      ? input.people
      : input.people.filter((person) => sameSquad(person, viewer));
  type MonthStat = { person: LeaderboardPerson; month: string; nr: number; deals: number };
  const months: MonthStat[] = [];
  let streakWinner: { person: LeaderboardPerson; days: number } | null = null;
  let consistentWinner: { person: LeaderboardPerson; months: number } | null = null;
  for (const person of candidates) {
    const mine = personDeals(person, input.deals);
    const byMonth = new Map<string, { nr: number; deals: number }>();
    for (const deal of mine) {
      if (!deal.closedOn) continue;
      const key = monthKeyOf(deal.closedOn);
      const current = byMonth.get(key) ?? { nr: 0, deals: 0 };
      current.nr = MONEY(current.nr + attributed(deal, person.userId));
      current.deals += 1;
      byMonth.set(key, current);
    }
    for (const [month, stat] of byMonth) {
      months.push({ person, month, nr: stat.nr, deals: stat.deals });
    }
    const days = longestStreak(mine.map((deal) => deal.closedOn ?? ""));
    if (!streakWinner || days > streakWinner.days) streakWinner = { person, days };
    const target = monthlyTarget(person);
    const hit = [...byMonth.values()].filter((stat) => target > 0 && stat.nr >= target).length;
    if (!consistentWinner || hit > consistentWinner.months)
      consistentWinner = { person, months: hit };
  }
  const best = [...months].sort(
    (a, b) => b.nr - a.nr || b.deals - a.deals || a.month.localeCompare(b.month),
  )[0];
  const busiest = [...months].sort(
    (a, b) => b.deals - a.deals || b.nr - a.nr || a.month.localeCompare(b.month),
  )[0];
  const present = (person: LeaderboardPerson) => {
    const masked = visibility(viewer, person, false) !== "full";
    return {
      agentName: masked ? maskLabel(person, input.people, viewer) : person.name,
      masked,
    };
  };
  return stripSensitive({
    bestMonth: best ? { ...present(best.person), month: best.month, totalNr: best.nr } : null,
    mostDeals: busiest
      ? { ...present(busiest.person), month: busiest.month, dealsClosed: busiest.deals }
      : null,
    longestStreak: streakWinner
      ? { ...present(streakWinner.person), days: streakWinner.days }
      : null,
    mostConsistent: consistentWinner
      ? { ...present(consistentWinner.person), months: consistentWinner.months }
      : null,
  });
}

export function buildTeamComparison(input: BuildInput): TeamsPayload {
  const viewer = viewerPerson(input.people, input.viewerId, input.viewerRole);
  const window = resolvePeriod(input.query, input.now);
  const leads = input.people.filter((person) => {
    const reports = input.people.some((other) => other.reportingToId === person.userId);
    return person.role === "manager" || person.role === "admin" || reports;
  });
  const revealNames = viewer.role === "admin" || viewer.band === "N3";
  const teams: TeamCard[] = leads.map((lead) => {
    const members = input.people.filter((person) => inSquad(person, lead.userId));
    const scores = members.map((person) => scorePerson(person, input.deals, window, input.now));
    const totalNr = MONEY(scores.reduce((sum, score) => sum + score.totalNr, 0));
    const teamTarget = MONEY(
      scores.reduce((sum, score) => {
        const monthly = monthlyTarget(score.person);
        const span =
          window.kind === "quarter"
            ? 3
            : window.kind === "year"
              ? 12
              : window.kind === "all"
                ? 12
                : 1;
        return sum + monthly * span;
      }, 0),
    );
    const top = [...scores].sort(compareScores)[0];
    const own = sameSquad(lead, viewer) || lead.userId === viewer.userId;
    const showTop = revealNames || own;
    return {
      managerId: lead.userId,
      managerName: lead.name,
      totalNr,
      teamTarget,
      achievementPercent: achievement(totalNr, teamTarget),
      membersAboveTarget: scores.filter((score) => score.achievementPercent >= 100).length,
      memberCount: members.length,
      topPerformerName: showTop && top ? top.person.name : null,
      topPerformerNr: showTop && top ? top.totalNr : null,
    };
  });
  teams.sort((a, b) => b.totalNr - a.totalNr || a.managerName.localeCompare(b.managerName));
  const mine = assembleLeaderboard({
    ...input,
    query: { ...input.query, scope: "team", teamId: undefined },
    exportMode: false,
  });
  return stripSensitive({ teams, myTeam: mine.entries });
}

export const EXPORT_HEADERS = [
  "Rank",
  "Agent Name",
  "Designation",
  "Grade",
  "Team/Manager",
  "NR Achieved",
  "Target Achievement %",
  "Deals Closed",
  "Units",
  "Badges Earned",
  "Status",
];

export function exportMatrix(payload: LeaderboardPayload) {
  const rows = payload.entries.map((row) => [
    String(row.rank),
    row.agentName,
    row.designation ?? "",
    row.grade ?? "",
    row.teamName,
    formatINR(row.totalNr),
    `${row.targetAchievementPercent}%`,
    String(row.dealsClosed),
    String(row.unitsClosed),
    row.badges.map((badge) => badge.name).join(", "),
    row.targetAchievementPercent >= 100 ? "Above Target" : "Below Target",
  ]);
  return { headers: EXPORT_HEADERS, rows };
}

export function collectKeys(value: unknown, keys = new Set<string>()) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

function stripSensitive<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripSensitive(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if ((FORBIDDEN_LEADERBOARD_KEYS as readonly string[]).includes(key)) continue;
      if (key === "target") continue;
      out[key] = stripSensitive(child);
    }
    return out as T;
  }
  return value;
}
