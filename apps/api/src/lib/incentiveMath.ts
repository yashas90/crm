/**
 * Incentive slabs (team-size bands, not seniority).
 *
 * eligibilityTarget = monthlyBasic * multiplier
 * if achievedNR <= eligibilityTarget: incentive = 0
 * else: incentive = (achievedNR - eligibilityTarget) * aboveTargetPercent
 *
 * The sheet also publishes a till-target percent. With one threshold, that rate is
 * the base slab: it is shown on the slab card and used for convertible deals and
 * for the N1 team kicker. Standard deals above the single threshold use aboveRate
 * on the excess only. Revenue up to the eligibility target is never incentivized.
 *
 * Convertible deals use the base (till-target) percent on their excess, not aboveRate.
 * Leaders' self-business uses only deals that are not shared (one share row, or 100%
 * to that person). N1 also earns 10% of a team member's base-slab incentive when that
 * member's collected net revenue is above 6x their own monthly basic. N1's salary
 * is not part of that team calc.
 *
 * 20% of any incentive is ESOP, 80% is cash. Disbursement is quarterly.
 * Provisional = formula on approved-but-not-collected NR. Earned = formula on
 * approved AND invoice-collected NR. Due stays 0 until something is earned.
 */

export const INCENTIVE_BANDS = {
  NE: { multiplier: 5, tillRate: 0.05, aboveRate: 0.15, team: false },
  N0: { multiplier: 5, tillRate: 0.05, aboveRate: 0.15, team: false },
  N1: { multiplier: 5, tillRate: 0.05, aboveRate: 0.15, team: true },
  N2: { multiplier: 4, tillRate: 0.03, aboveRate: 0.07, team: true },
  N3: { multiplier: 3, tillRate: 0.015, aboveRate: 0.05, team: true },
} as const;

export type IncentiveBand = keyof typeof INCENTIVE_BANDS;

export const ESOP_RATE = 0.2;
export const CASH_RATE = 0.8;
export const N1_TEAM_KICKER_RATE = 0.1;
export const N1_TEAM_MEMBER_MULTIPLE = 6;

const MONEY = (value: number) => Math.round(value * 100) / 100;

export function isIncentiveBand(value: string | null | undefined): value is IncentiveBand {
  return value === "NE" || value === "N0" || value === "N1" || value === "N2" || value === "N3";
}

export type InvoiceStatus = "not_raised" | "raised" | "collected";
export type TcfStatus = "draft" | "pending_approval" | "approved" | "rejected";

export type IncentiveShare = { userId: string; sharePercent: number };

export type IncentiveDeal = {
  id: string;
  tcfCode: string;
  status: TcfStatus;
  invoiceStatus: InvoiceStatus;
  netRevenue: number;
  convertible: boolean;
  closedOn?: string | null;
  productName?: string | null;
  shares: IncentiveShare[];
};

export type SlabIncentive = {
  eligibilityTarget: number;
  incentive: number;
  tillIncentive: number;
  aboveIncentive: number;
  tillRate: number;
  aboveRate: number;
};

/**
 * One published threshold: nothing until NR is above eligibility, then the
 * above-target percent applies to the excess. Convertible rupees in that excess
 * use the till-target (base) percent instead.
 */
export function slabIncentive(input: {
  achievedNr: number;
  monthlyBasic: number;
  multiplier: number;
  tillRate: number;
  aboveRate: number;
  convertibleNr?: number;
}): SlabIncentive {
  const eligibilityTarget = MONEY(Math.max(0, input.monthlyBasic) * input.multiplier);
  const achievedNr = Math.max(0, input.achievedNr);
  const convertibleNr = Math.min(Math.max(0, input.convertibleNr ?? 0), achievedNr);
  const standardNr = MONEY(achievedNr - convertibleNr);
  if (achievedNr <= eligibilityTarget) {
    return {
      eligibilityTarget,
      incentive: 0,
      tillIncentive: 0,
      aboveIncentive: 0,
      tillRate: input.tillRate,
      aboveRate: input.aboveRate,
    };
  }
  const standardExcess = Math.max(0, standardNr - eligibilityTarget);
  const thresholdLeft = Math.max(0, eligibilityTarget - standardNr);
  const convertibleExcess = Math.max(0, convertibleNr - thresholdLeft);
  const tillIncentive = MONEY(convertibleExcess * input.tillRate);
  const aboveIncentive = MONEY(standardExcess * input.aboveRate);
  return {
    eligibilityTarget,
    incentive: MONEY(tillIncentive + aboveIncentive),
    tillIncentive,
    aboveIncentive,
    tillRate: input.tillRate,
    aboveRate: input.aboveRate,
  };
}

export function splitEsop(incentive: number) {
  const amount = MONEY(Math.max(0, incentive));
  const esop = MONEY(amount * ESOP_RATE);
  const cash = MONEY(amount - esop);
  return { esop, cash };
}

export function shareOf(deal: IncentiveDeal, userId: string) {
  return deal.shares.find((share) => share.userId === userId)?.sharePercent ?? 0;
}

/** True when this person is the only participant (sole row or 100% and nobody else). */
export function isExclusiveSelfDeal(deal: IncentiveDeal, userId: string) {
  const active = deal.shares.filter((share) => share.sharePercent > 0);
  const mine = shareOf(deal, userId);
  if (mine <= 0) return false;
  const others = active.filter((share) => share.userId !== userId);
  return others.length === 0;
}

export function attributedNr(deal: IncentiveDeal, userId: string) {
  return MONEY((Math.max(0, deal.netRevenue) * shareOf(deal, userId)) / 100);
}

function approved(deal: IncentiveDeal) {
  return deal.status === "approved";
}

function collected(deal: IncentiveDeal) {
  return approved(deal) && deal.invoiceStatus === "collected";
}

function nrFor(
  deals: IncentiveDeal[],
  userId: string,
  mode: "counted" | "confirm",
  exclusiveOnly: boolean,
) {
  let standard = 0;
  let convertible = 0;
  for (const deal of deals) {
    const include = mode === "confirm" ? collected(deal) : approved(deal);
    if (!include) continue;
    if (exclusiveOnly && !isExclusiveSelfDeal(deal, userId)) continue;
    const amount = attributedNr(deal, userId);
    if (deal.convertible) convertible += amount;
    else standard += amount;
  }
  return {
    standard: MONEY(standard),
    convertible: MONEY(convertible),
    total: MONEY(standard + convertible),
  };
}

export type AgentPayout = {
  countedSelfNr: number;
  countedTeamNr: number;
  confirmSelfNr: number;
  confirmTeamNr: number;
  provisional: number;
  earned: number;
  provisionalEsop: number;
  provisionalCash: number;
  esop: number;
  cash: number;
  payAdv: number;
  due: number;
  n1TeamKicker: number;
  eligibilityTarget: number;
  tillRate: number;
  aboveRate: number;
  tillIncentive: number;
  aboveIncentive: number;
  grossIncentive: number;
  achievedNr: number;
  achievementPercent: number;
  deals: {
    id: string;
    tcfCode: string;
    countedNr: number;
    confirmNr: number;
    exclusive: boolean;
    invoiceStatus: InvoiceStatus;
  }[];
};

export function summarizeAgentIncentive(input: {
  agentId: string;
  band: IncentiveBand | null;
  monthlyBasic: number;
  deals: IncentiveDeal[];
  team?: { userId: string; monthlyBasic: number; deals: IncentiveDeal[] }[];
  disbursedAmount?: number;
}): AgentPayout {
  const band = input.band ? INCENTIVE_BANDS[input.band] : null;
  const leader = Boolean(band?.team);
  const countedSelf = nrFor(input.deals, input.agentId, "counted", false);
  const confirmSelf = nrFor(input.deals, input.agentId, "confirm", false);
  const formulaCounted = nrFor(input.deals, input.agentId, "counted", leader);
  const formulaConfirm = nrFor(input.deals, input.agentId, "confirm", leader);

  let countedTeam = 0;
  let confirmTeam = 0;
  let teamCountedStandard = 0;
  let teamCountedConvertible = 0;
  let teamConfirmStandard = 0;
  let teamConfirmConvertible = 0;
  let n1TeamKicker = 0;

  for (const member of input.team ?? []) {
    if (member.userId === input.agentId) continue;
    const memberCounted = nrFor(member.deals, member.userId, "counted", false);
    const memberConfirm = nrFor(member.deals, member.userId, "confirm", false);
    countedTeam += memberCounted.total;
    confirmTeam += memberConfirm.total;
    teamCountedStandard += memberCounted.standard;
    teamCountedConvertible += memberCounted.convertible;
    teamConfirmStandard += memberConfirm.standard;
    teamConfirmConvertible += memberConfirm.convertible;

    if (
      input.band === "N1" &&
      memberConfirm.total > member.monthlyBasic * N1_TEAM_MEMBER_MULTIPLE
    ) {
      const base = slabIncentive({
        achievedNr: memberConfirm.total,
        monthlyBasic: member.monthlyBasic,
        multiplier: INCENTIVE_BANDS.N1.multiplier,
        tillRate: INCENTIVE_BANDS.N1.tillRate,
        aboveRate: INCENTIVE_BANDS.N1.tillRate,
        convertibleNr: memberConfirm.convertible,
      });
      n1TeamKicker += base.incentive * N1_TEAM_KICKER_RATE;
    }
  }

  const rates = band ?? INCENTIVE_BANDS.NE;
  const personalCountedNr =
    input.band === "N2" || input.band === "N3"
      ? {
          standard: formulaCounted.standard + teamCountedStandard,
          convertible: formulaCounted.convertible + teamCountedConvertible,
        }
      : formulaCounted;
  const personalConfirmNr =
    input.band === "N2" || input.band === "N3"
      ? {
          standard: formulaConfirm.standard + teamConfirmStandard,
          convertible: formulaConfirm.convertible + teamConfirmConvertible,
        }
      : formulaConfirm;

  const countedCalc = band
    ? slabIncentive({
        achievedNr: personalCountedNr.standard + personalCountedNr.convertible,
        convertibleNr: personalCountedNr.convertible,
        monthlyBasic: input.monthlyBasic,
        multiplier: rates.multiplier,
        tillRate: rates.tillRate,
        aboveRate: rates.aboveRate,
      })
    : {
        eligibilityTarget: 0,
        incentive: 0,
        tillIncentive: 0,
        aboveIncentive: 0,
        tillRate: 0,
        aboveRate: 0,
      };
  const earnedCalc = band
    ? slabIncentive({
        achievedNr: personalConfirmNr.standard + personalConfirmNr.convertible,
        convertibleNr: personalConfirmNr.convertible,
        monthlyBasic: input.monthlyBasic,
        multiplier: rates.multiplier,
        tillRate: rates.tillRate,
        aboveRate: rates.aboveRate,
      })
    : {
        eligibilityTarget: countedCalc.eligibilityTarget,
        incentive: 0,
        tillIncentive: 0,
        aboveIncentive: 0,
        tillRate: 0,
        aboveRate: 0,
      };

  const earnedCore = earnedCalc.incentive + collectedTeamKicker(n1TeamKicker);
  const countedCore = countedCalc.incentive + n1TeamKicker;
  const earned = MONEY(earnedCore);
  const provisional = MONEY(Math.max(0, countedCore - earnedCore));
  const grossIncentive = MONEY(earnedCalc.incentive);
  const achievedNr = MONEY(personalConfirmNr.standard + personalConfirmNr.convertible);
  const achievementPercent =
    earnedCalc.eligibilityTarget > 0
      ? Math.round((achievedNr / earnedCalc.eligibilityTarget) * 10000) / 100
      : 0;
  const earnedSplit = splitEsop(earned);
  const provisionalSplit = splitEsop(provisional);
  const disbursed = MONEY(Math.max(0, input.disbursedAmount ?? 0));

  return {
    countedSelfNr: countedSelf.total,
    countedTeamNr: MONEY(countedTeam),
    confirmSelfNr: confirmSelf.total,
    confirmTeamNr: MONEY(confirmTeam),
    provisional,
    earned,
    provisionalEsop: provisionalSplit.esop,
    provisionalCash: provisionalSplit.cash,
    esop: earnedSplit.esop,
    cash: earnedSplit.cash,
    payAdv: earnedSplit.cash,
    due: MONEY(Math.max(0, earned - disbursed)),
    n1TeamKicker: MONEY(n1TeamKicker),
    eligibilityTarget: countedCalc.eligibilityTarget,
    tillRate: rates.tillRate,
    aboveRate: rates.aboveRate,
    tillIncentive: earnedCalc.tillIncentive,
    aboveIncentive: earnedCalc.aboveIncentive,
    grossIncentive,
    achievedNr,
    achievementPercent,
    deals: input.deals.filter(approved).map((deal) => ({
      id: deal.id,
      tcfCode: deal.tcfCode,
      countedNr: attributedNr(deal, input.agentId),
      confirmNr: collected(deal) ? attributedNr(deal, input.agentId) : 0,
      exclusive: isExclusiveSelfDeal(deal, input.agentId),
      invoiceStatus: deal.invoiceStatus,
    })),
  };
}

function collectedTeamKicker(amount: number) {
  return amount;
}
