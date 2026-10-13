"use client";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import type { TcfForm } from "@/lib/tcf-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type TcfListItem = {
  id: string;
  tcfCode: string;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  productName: string | null;
  primaryApplicant: string | null;
  dealClosureDate: string | null;
  invoiceStatus: "not_raised" | "raised" | "collected";
  netRevenue: string;
  incentiveNote: string;
  createdAt: string;
};

export type TcfDetail = TcfListItem & {
  form: TcfForm;
  rejectionReason: string | null;
  currency: string;
  events: { id: string; action: string; note: string | null; createdAt: string }[];
};

export function useTransactionClosures(search: string, status: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  const query = params.toString();
  return useQuery({
    queryKey: ["transaction-closures", search, status],
    queryFn: () =>
      apiGet<{ items: TcfListItem[]; total: number }>(
        `/api/transaction-closures${query ? `?${query}` : ""}`,
      ),
  });
}

export function useTransactionClosure(id: string | undefined) {
  return useQuery({
    queryKey: ["transaction-closure", id],
    queryFn: () => apiGet<TcfDetail>(`/api/transaction-closures/${id}`),
    enabled: Boolean(id),
  });
}

export function useTcfMutations() {
  const client = useQueryClient();
  const refresh = async (id?: string) => {
    await client.invalidateQueries({ queryKey: ["transaction-closures"] });
    if (id) await client.invalidateQueries({ queryKey: ["transaction-closure", id] });
  };
  return {
    create: useMutation({
      mutationFn: (form: TcfForm) => apiPost<TcfDetail>("/api/transaction-closures", form),
      onSuccess: () => refresh(),
    }),
    update: useMutation({
      mutationFn: ({ id, form }: { id: string; form: TcfForm }) =>
        apiPatch<TcfDetail>(`/api/transaction-closures/${id}`, form),
      onSuccess: (_data, vars) => refresh(vars.id),
    }),
    submit: useMutation({
      mutationFn: (id: string) => apiPost<TcfDetail>(`/api/transaction-closures/${id}/submit`, {}),
      onSuccess: (_data, id) => refresh(id),
    }),
    approve: useMutation({
      mutationFn: (id: string) => apiPost<TcfDetail>(`/api/transaction-closures/${id}/approve`, {}),
      onSuccess: (_data, id) => refresh(id),
    }),
    reject: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) =>
        apiPost<TcfDetail>(`/api/transaction-closures/${id}/reject`, { reason }),
      onSuccess: (_data, vars) => refresh(vars.id),
    }),
    invoice: useMutation({
      mutationFn: ({ id, invoiceStatus }: { id: string; invoiceStatus: string }) =>
        apiPatch<TcfDetail>(`/api/transaction-closures/${id}/invoice`, { invoiceStatus }),
      onSuccess: (_data, vars) => refresh(vars.id),
    }),
    duplicate: useMutation({
      mutationFn: (id: string) =>
        apiPost<TcfDetail>(`/api/transaction-closures/${id}/duplicate`, {}),
    }),
    remove: useMutation({
      mutationFn: (id: string) => apiDelete<{ id: string }>(`/api/transaction-closures/${id}`),
      onSuccess: () => refresh(),
    }),
  };
}
