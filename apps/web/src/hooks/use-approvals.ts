"use client";

import { apiDownload, apiGet, apiPost } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type IncentiveApproval = {
  id: string;
  userId: string;
  monthKey: string;
  monthLabel: string;
  quarterKey: string;
  quarterName: string;
  employeeName: string;
  designation: string | null;
  grade: string | null;
  monthlySalary: number;
  eligibilityTarget: number;
  nrAchieved: number;
  achievementPercent: number;
  incentiveTillTarget: number;
  incentiveAboveTarget: number;
  grossIncentive: number;
  cashAmount: number;
  esopAmount: number;
  n1Bonus: number;
  totalPayable: number;
  status: string;
  rejectionReason: string | null;
  deals: {
    tcfCode: string;
    propertyName: string | null;
    dealValue: number;
    nr: number;
    closedOn: string | null;
    invoiceStatus: string;
  }[];
};

export type AppraisalApproval = {
  id: string;
  userId: string;
  quarterKey: string;
  quarterName: string;
  employeeName: string;
  designation: string | null;
  grade: string | null;
  requiredSales: number | null;
  requiredUnits: number | null;
  achievedSales: number;
  achievedUnits: number;
  eligible: boolean;
  currentSalary: number;
  hikePercent: number;
  newSalary: number;
  incrementAmount: number;
  status: string;
  rejectionReason: string | null;
  effectiveFrom: string | null;
  effectiveFromLabel: string | null;
  deals: {
    tcfCode: string;
    propertyName: string | null;
    dealValue: number;
    nr: number;
    closedOn: string | null;
    invoiceRaised: boolean;
    paymentCollected: boolean;
  }[];
};

export type ApprovalSummary = {
  pendingIncentives: { employees: number; total: number };
  approvedThisQuarter: { employees: number; total: number };
  pendingAppraisals: { employees: number };
  hikesToApply: { employees: number; totalIncrement: number };
};

export type ApprovalFilters = {
  month?: string;
  quarter?: string;
  grade?: string;
  status?: string;
  q?: string;
  eligible?: boolean;
};

export type QuarterBundle = {
  quarter: { name: string; label: string };
  rows: {
    userId: string;
    employeeName: string;
    grade: string | null;
    cashTotal: number;
    esopTotal: number;
    combinedTotal: number;
    canDisburse: boolean;
    months: { monthLabel: string; status: string; totalPayable: number }[];
  }[];
};

function queryString(filters: ApprovalFilters) {
  const params = new URLSearchParams();
  if (filters.month) params.set("month", filters.month);
  if (filters.quarter) params.set("quarter", filters.quarter);
  if (filters.grade) params.set("grade", filters.grade);
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  if (filters.eligible) params.set("eligible", "1");
  const value = params.toString();
  return value ? `?${value}` : "";
}

function invalidate(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: ["approvals"] });
  void client.invalidateQueries({ queryKey: ["incentive-me"] });
  void client.invalidateQueries({ queryKey: ["incentive-disbursements"] });
  void client.invalidateQueries({ queryKey: ["appraisal"] });
}

export function useApprovalSummary(enabled: boolean) {
  return useQuery({
    queryKey: ["approvals", "summary"],
    enabled,
    queryFn: () => apiGet<ApprovalSummary>("/api/approvals/summary"),
  });
}

export function useIncentiveApprovals(filters: ApprovalFilters, enabled: boolean) {
  return useQuery({
    queryKey: ["approvals", "incentives", filters],
    enabled,
    queryFn: () => apiGet<IncentiveApproval[]>(`/api/approvals/incentives${queryString(filters)}`),
  });
}

export function useAppraisalApprovals(filters: ApprovalFilters, enabled: boolean) {
  return useQuery({
    queryKey: ["approvals", "appraisals", filters],
    enabled,
    queryFn: () => apiGet<AppraisalApproval[]>(`/api/approvals/appraisals${queryString(filters)}`),
  });
}

export function useQuarterBundle(quarter: string, enabled: boolean) {
  return useQuery({
    queryKey: ["approvals", "disbursement", quarter],
    enabled,
    queryFn: () =>
      apiGet<QuarterBundle>(`/api/approvals/incentives/disbursement?quarter=${quarter}`),
  });
}

export function useApprovalActions() {
  const client = useQueryClient();
  const done = () => invalidate(client);
  return {
    approveIncentive: useMutation({
      mutationFn: (id: string) => apiPost(`/api/approvals/incentives/${id}/approve`, {}),
      onSuccess: done,
    }),
    rejectIncentive: useMutation({
      mutationFn: (body: { id: string; reason: string }) =>
        apiPost(`/api/approvals/incentives/${body.id}/reject`, { reason: body.reason }),
      onSuccess: done,
    }),
    approveEligibleIncentives: useMutation({
      mutationFn: (filters: ApprovalFilters) =>
        apiPost("/api/approvals/incentives/approve-eligible", {
          month: filters.month,
          quarter: filters.quarter,
          grade: filters.grade,
        }),
      onSuccess: done,
    }),
    disburse: useMutation({
      mutationFn: (body: { quarter: string; userId?: string }) =>
        apiPost("/api/approvals/incentives/disburse", body),
      onSuccess: done,
    }),
    calculateIncentives: useMutation({
      mutationFn: (month?: string) => apiPost("/api/approvals/incentives/calculate", { month }),
      onSuccess: done,
    }),
    approveAppraisal: useMutation({
      mutationFn: (id: string) => apiPost(`/api/approvals/appraisals/${id}/approve`, {}),
      onSuccess: done,
    }),
    rejectAppraisal: useMutation({
      mutationFn: (body: { id: string; reason: string }) =>
        apiPost(`/api/approvals/appraisals/${body.id}/reject`, { reason: body.reason }),
      onSuccess: done,
    }),
    approveEligibleAppraisals: useMutation({
      mutationFn: (filters: ApprovalFilters) =>
        apiPost("/api/approvals/appraisals/approve-eligible", {
          quarter: filters.quarter,
          grade: filters.grade,
        }),
      onSuccess: done,
    }),
    calculateAppraisals: useMutation({
      mutationFn: (quarter?: string) => apiPost("/api/approvals/appraisals/calculate", { quarter }),
      onSuccess: done,
    }),
  };
}

export function downloadIncentiveSheet(filters: ApprovalFilters) {
  return apiDownload(
    `/api/approvals/incentives/export${queryString(filters)}`,
    "incentive-sheet.xls",
  );
}

export function downloadAppraisalSheet(filters: ApprovalFilters) {
  return apiDownload(
    `/api/approvals/appraisals/export${queryString(filters)}`,
    "appraisal-sheet.xls",
  );
}
