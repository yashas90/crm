"use client";

import { apiGet, apiPost, apiPut } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type Payout = {
  countedSelfNr: number;
  countedTeamNr: number;
  confirmSelfNr: number;
  confirmTeamNr: number;
  provisional: number;
  earned: number;
  esop: number;
  cash: number;
  payAdv: number;
  due: number;
  n1TeamKicker: number;
  eligibilityTarget: number;
  tillRate: number;
  aboveRate: number;
  deals: {
    id: string;
    tcfCode: string;
    countedNr: number;
    confirmNr: number;
    exclusive: boolean;
    invoiceStatus: string;
  }[];
};

export type IncentiveMe = {
  quarter: { year: number; code: string; label: string; name: string };
  profile: {
    userId: string;
    name: string;
    band: string | null;
    designation: string | null;
    monthlyBasic: number;
  } | null;
  slabs: {
    band: string;
    multiplier: number;
    tillPercent: number;
    abovePercent: number;
    team: boolean;
  }[];
  payout: Payout;
  disbursed: boolean;
};

export function useMyIncentive(quarter: string) {
  return useQuery({
    queryKey: ["incentive-me", quarter],
    queryFn: () => apiGet<IncentiveMe>(`/api/incentives/me?quarter=${quarter}`),
  });
}

export function useTeamIncentive(quarter: string) {
  return useQuery({
    queryKey: ["incentive-team", quarter],
    queryFn: () =>
      apiGet<{
        quarter: IncentiveMe["quarter"];
        note: string | null;
        members: { userId: string; name: string; band: string | null; payout: Payout }[];
      }>(`/api/incentives/team?quarter=${quarter}`),
  });
}

export function useDisbursements(quarter: string, enabled: boolean) {
  return useQuery({
    queryKey: ["incentive-disbursements", quarter],
    enabled,
    queryFn: () =>
      apiGet<{
        quarter: IncentiveMe["quarter"];
        rows: {
          userId: string;
          name: string;
          band: string | null;
          designation: string | null;
          monthlyBasic: number;
          disbursed: boolean;
          payout: Payout;
        }[];
      }>(`/api/incentives/disbursements?quarter=${quarter}`),
  });
}

export type AppraisalResult = {
  userId: string;
  name: string;
  designation: string | null;
  band: string | null;
  monthlyBasic: number;
  mapped: boolean;
  grade: string | null;
  minSales: number | null;
  minUnits: number | null;
  hikePercent: number;
  countedSales: number;
  countedUnits: number;
  eligible: boolean;
  hikeAmount: number;
  recommendedBasic: number;
};

export type AppraisalPolicyRow = {
  designation: string;
  grade: string | null;
  minSales: number;
  minUnits: number;
  hikePercent: number;
};

export function useAppraisal(quarter: string) {
  return useQuery({
    queryKey: ["appraisal", quarter],
    queryFn: () =>
      apiGet<{
        quarter: IncentiveMe["quarter"];
        policy: AppraisalPolicyRow[];
        results: AppraisalResult[];
      }>(`/api/appraisals?quarter=${quarter}`),
  });
}

export function useSaveIncentiveProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      userId: string;
      band?: string | null;
      designation?: string | null;
      monthlyBasic?: number;
    }) => apiPut<{ ok: boolean }>("/api/incentives/profiles", body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["appraisal"] });
      void client.invalidateQueries({ queryKey: ["incentive-me"] });
      void client.invalidateQueries({ queryKey: ["incentive-team"] });
      void client.invalidateQueries({ queryKey: ["incentive-disbursements"] });
    },
  });
}

export function useDisburseIncentive() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { userId: string; quarter: string }) =>
      apiPost<{ ok: boolean }>("/api/incentives/disbursements", body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["incentive-disbursements"] });
      void client.invalidateQueries({ queryKey: ["incentive-me"] });
    },
  });
}
