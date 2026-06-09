"use client";

import {
  bulkAssignLeads,
  bulkDeleteLeads,
  bulkUpdateLeadStatus,
  summarizeBulkResult,
} from "@/lib/bulk-leads";
import type { LeadStatus } from "@propninja/types/enums";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useBulkLeadActions() {
  const queryClient = useQueryClient();

  async function invalidateLeads() {
    await queryClient.invalidateQueries({ queryKey: ["leads"] });
    await queryClient.invalidateQueries({ queryKey: ["leads", "stage-counts"] });
    await queryClient.invalidateQueries({ queryKey: ["leads", "scope-counts"] });
  }

  const updateStatus = useMutation({
    mutationFn: ({ leadIds, leadStatus }: { leadIds: string[]; leadStatus: LeadStatus }) =>
      bulkUpdateLeadStatus(leadIds, leadStatus),
    onSuccess: async (result) => {
      await invalidateLeads();
      summarizeBulkResult(result, (count) => `Updated status for ${count} lead(s)`);
    },
  });

  const assign = useMutation({
    mutationFn: ({ leadIds, userId }: { leadIds: string[]; userId: string }) =>
      bulkAssignLeads(leadIds, userId),
    onSuccess: async (result) => {
      await invalidateLeads();
      summarizeBulkResult(result, (count) => `Assigned ${count} lead(s)`);
    },
  });

  const archive = useMutation({
    mutationFn: (leadIds: string[]) => bulkDeleteLeads(leadIds),
    onSuccess: async (result) => {
      await invalidateLeads();
      summarizeBulkResult(result, (count) => `Archived ${count} lead(s)`);
    },
  });

  return {
    updateStatus,
    assign,
    archive,
    isBusy: updateStatus.isPending || assign.isPending || archive.isPending,
  };
}
