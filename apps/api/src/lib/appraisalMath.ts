/**
 * Gold Sheet appraisal, Bangalore sales. This is not the incentive slab.
 * A quarter pays a 10% hike on monthly basic only when the person hits both
 * the minimum sales and the minimum units. A closure counts only when the TCF
 * is admin-approved and the invoice is collected. Contribution is individual:
 * units and sales are the agent's own share (100% = 1, 50% = 0.5). Team
 * members' closures are never added to a leader.
 * The hike is a recommendation. Payroll is not changed here.
 */

export type AppraisalGrade = "N1" | "N0" | null;

export type AppraisalPolicyRow = {
  designation: string;
  grade: AppraisalGrade;
  minSales: number;
  minUnits: number;
  hikePercent: number;
};

export const APPRAISAL_POLICY: AppraisalPolicyRow[] = [
  { designation: "Senior Sales Manager", grade: "N1", minSales: 7, minUnits: 7, hikePercent: 0.1 },
  { designation: "Sales Manager", grade: "N1", minSales: 6, minUnits: 6, hikePercent: 0.1 },
  {
    designation: "Associate Sales Manager",
    grade: "N1",
    minSales: 6,
    minUnits: 6,
    hikePercent: 0.1,
  },
  {
    designation: "Senior Investment Manager",
    grade: "N0",
    minSales: 6,
    minUnits: 6,
    hikePercent: 0.1,
  },
  { designation: "Investment Manager", grade: "N0", minSales: 5, minUnits: 5, hikePercent: 0.1 },
  {
    designation: "Associate Investment Manager",
    grade: "N0",
    minSales: 5,
    minUnits: 5,
    hikePercent: 0.1,
  },
  {
    designation: "Senior Portfolio Manager",
    grade: "N0",
    minSales: 5,
    minUnits: 5,
    hikePercent: 0.1,
  },
  { designation: "Portfolio Manager", grade: "N0", minSales: 5, minUnits: 5, hikePercent: 0.1 },
  {
    designation: "Associate Portfolio Manager",
    grade: "N0",
    minSales: 5,
    minUnits: 5,
    hikePercent: 0.1,
  },
  {
    designation: "Senior Real Estate Consultant",
    grade: null,
    minSales: 5,
    minUnits: 5,
    hikePercent: 0.1,
  },
  {
    designation: "Real Estate Consultant",
    grade: null,
    minSales: 5,
    minUnits: 5,
    hikePercent: 0.1,
  },
  {
    designation: "Associate Real Estate Consultant",
    grade: null,
    minSales: 5,
    minUnits: 5,
    hikePercent: 0.1,
  },
];

export type AppraisalDeal = {
  agentId: string;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  invoiceStatus: "not_raised" | "raised" | "collected";
  sharePercent: number;
};

export function policyForDesignation(designation: string | null | undefined) {
  const name = designation?.trim().toLowerCase();
  if (!name) return null;
  return APPRAISAL_POLICY.find((row) => row.designation.toLowerCase() === name) ?? null;
}

export function appraisalContribution(deals: AppraisalDeal[], agentId: string) {
  let countedSales = 0;
  let countedUnits = 0;
  for (const deal of deals) {
    if (deal.agentId !== agentId) continue;
    if (deal.status !== "approved" || deal.invoiceStatus !== "collected") continue;
    const share = Math.max(0, deal.sharePercent) / 100;
    countedSales += share;
    countedUnits += share;
  }
  return {
    countedSales: Math.round(countedSales * 100) / 100,
    countedUnits: Math.round(countedUnits * 100) / 100,
  };
}

export function appraisalResult(input: {
  agentId: string;
  designation: string | null;
  monthlyBasic: number;
  deals: AppraisalDeal[];
}) {
  const policy = policyForDesignation(input.designation);
  const contribution = appraisalContribution(input.deals, input.agentId);
  const basic = Math.max(0, input.monthlyBasic);
  if (!policy) {
    return {
      mapped: false,
      grade: null as AppraisalGrade,
      minSales: null as number | null,
      minUnits: null as number | null,
      hikePercent: 0,
      ...contribution,
      eligible: false,
      hikeAmount: 0,
      recommendedBasic: basic,
    };
  }
  const eligible =
    contribution.countedSales >= policy.minSales && contribution.countedUnits >= policy.minUnits;
  const hikeAmount = eligible ? Math.round(basic * policy.hikePercent * 100) / 100 : 0;
  return {
    mapped: true,
    grade: policy.grade,
    minSales: policy.minSales,
    minUnits: policy.minUnits,
    hikePercent: policy.hikePercent,
    ...contribution,
    eligible,
    hikeAmount,
    recommendedBasic: Math.round((basic + hikeAmount) * 100) / 100,
  };
}
