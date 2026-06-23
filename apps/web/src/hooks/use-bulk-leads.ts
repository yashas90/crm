"use client";

import {
  bulkAssignLeads,
  bulkDeleteLeads,
  bulkImportLeads,
  bulkUpdateLeadStatus,
  downloadLeadImportReport,
  fetchLeadImportBatches,
  summarizeBulkResult,
} from "@/lib/bulk-leads";
import { getErrorMessage } from "@/lib/errors";
import type { BulkLeadImportRow } from "@/lib/parse-leads-csv";
import { toast } from "@/lib/toast";
import type { LeadStatus } from "@propninja/types/enums";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
    mutationFn: ({ leadIds, userIds }: { leadIds: string[]; userIds: string[] }) =>
      bulkAssignLeads(leadIds, userIds),
    onSuccess: async (result, variables) => {
      await invalidateLeads();
      const agentCount = variables.userIds.length;
      summarizeBulkResult(result, (count) =>
        agentCount > 1
          ? `Assigned ${count} lead(s) across ${agentCount} agents`
          : `Assigned ${count} lead(s)`,
      );
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

export function useBulkImportLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      leads: BulkLeadImportRow[];
      skipDuplicates?: boolean;
      assignToUserId?: string;
      assignToUserIds?: string[];
      fileName?: string;
      totalCount?: number;
      invalidCount?: number;
      parseErrors?: { row: number; message: string }[];
    }) => bulkImportLeads(input),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["leads", "import-batches"] });
      const changedCount = result.createdCount + (result.updatedCount ?? 0);
      if (result.createdCount > 0 && (result.updatedCount ?? 0) > 0) {
        toast.success(
          `Imported ${result.createdCount} lead(s) and updated ${result.updatedCount} existing lead(s)`,
        );
      } else if (result.createdCount > 0) {
        toast.success(`Imported ${result.createdCount} lead(s)`);
      } else if ((result.updatedCount ?? 0) > 0) {
        toast.success(`Updated ${result.updatedCount} existing lead(s) from your CSV`);
      } else if (result.failedCount === 0 && result.skippedCount > 0) {
        toast.info("All rows were skipped (duplicate phone numbers)");
      } else if (changedCount === 0) {
        toast.error("No leads were imported");
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Bulk import failed"));
    },
  });
}

export function useLeadImportBatches(page: number, pageSize = 10) {
  return useQuery({
    queryKey: ["leads", "import-batches", page, pageSize],
    queryFn: () => fetchLeadImportBatches({ page, pageSize }),
    placeholderData: keepPreviousData,
  });
}

export function useLeadImportBatchOptions(enabled = true) {
  return useQuery({
    queryKey: ["leads", "import-batches", "options"],
    queryFn: () => fetchLeadImportBatches({ page: 1, pageSize: 100 }),
    enabled,
    staleTime: 60_000,
  });
}

export function useDownloadLeadImportReport() {
  return useMutation({
    mutationFn: ({ batchId, fileName }: { batchId: string; fileName: string }) =>
      downloadLeadImportReport(batchId, fileName),
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not download report"));
    },
  });
}
