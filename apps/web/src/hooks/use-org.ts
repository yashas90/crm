"use client";

import { ApiRequestError, apiGet, apiPatch } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type OrgRecord = {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  createdAt: string;
};

export type OrgPatchBody = {
  name?: string;
  website?: string | null;
  timezone?: string | null;
  settings?: Record<string, unknown>;
};

export function useOrg() {
  return useQuery({
    queryKey: ["org"],
    queryFn: () => apiGet<OrgRecord>("/api/org"),
    staleTime: 60_000,
  });
}

export function useUpdateOrg() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: OrgPatchBody) => apiPatch<OrgRecord>("/api/org", body),
    onSuccess: (data) => {
      queryClient.setQueryData(["org"], data);
    },
  });
}

export function orgPatchErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiRequestError ? error.message : fallback;
}
