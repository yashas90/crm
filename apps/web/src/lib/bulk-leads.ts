import { apiDelete, apiDownload, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import type { BulkLeadImportRow } from "@/lib/parse-leads-csv";
import { agentForRoundRobinIndex } from "@/lib/round-robin";
import { toast } from "@/lib/toast";
import type { LeadStatus } from "@propninja/types/enums";

export type BulkLeadResult = {
  succeeded: string[];
  failed: { id: string; message: string }[];
};

async function runBulk<T>(
  items: T[],
  action: (item: T, index: number) => Promise<void>,
  errorLabel: string,
): Promise<BulkLeadResult> {
  const succeeded: string[] = [];
  const failed: BulkLeadResult["failed"] = [];

  for (let index = 0; index < items.length; index++) {
    const id = items[index] as string;
    try {
      await action(items[index]!, index);
      succeeded.push(id);
    } catch (error) {
      const message = getErrorMessage(error, errorLabel);
      failed.push({ id, message });
      toast.error(`${errorLabel}: ${message}`);
    }
  }

  return { succeeded, failed };
}

export function bulkUpdateLeadStatus(leadIds: string[], leadStatus: LeadStatus) {
  return runBulk(
    leadIds,
    (id) => apiPatch(`/api/leads/${id}`, { leadStatus }),
    "Status update failed",
  );
}

export function bulkAssignLeads(leadIds: string[], userIds: string[]) {
  return runBulk(
    leadIds,
    (id, index) => {
      const userId = agentForRoundRobinIndex(userIds, index);
      return apiPost(`/api/leads/${id}/assign`, { user_id: userId });
    },
    "Assign failed",
  );
}

export function bulkDeleteLeads(leadIds: string[]) {
  return runBulk(leadIds, (id) => apiDelete(`/api/leads/${id}`), "Archive failed");
}

export type BulkImportLeadsResult = {
  batchId?: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  created: { row: number; id: string; phone: string }[];
  updated: { row: number; id: string; phone: string }[];
  skipped: { row: number; phone: string; reason: string }[];
  failed: { row: number; message: string }[];
};

export type LeadImportBatchRow = {
  id: string;
  fileName: string | null;
  status: "initiated" | "completed" | "failed";
  totalCount: number;
  uniqueCount: number;
  totalUploaded: number;
  duplicateCount: number;
  invalidCount: number;
  visitsBooked: number;
  hotCount: number;
  coldCount: number;
  droppedCount: number;
  notInterestedCount: number;
  uploadedBy: { name: string; email: string | null };
  createdAt: string;
  completedAt: string | null;
};

export type LeadImportBatchesResponse = {
  items: LeadImportBatchRow[];
  page: number;
  pageSize: number;
  total: number;
};

export function bulkImportLeads(input: {
  leads: BulkLeadImportRow[];
  skipDuplicates?: boolean;
  assignToUserId?: string;
  assignToUserIds?: string[];
  fileName?: string;
  totalCount?: number;
  invalidCount?: number;
  parseErrors?: { row: number; message: string }[];
}) {
  return apiPost<BulkImportLeadsResult>("/api/leads/bulk-import", input);
}

export function fetchLeadImportBatches(params: { page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  return apiGet<LeadImportBatchesResponse>(`/api/leads/import-batches${query ? `?${query}` : ""}`);
}

export function downloadLeadImportReport(batchId: string, fileName: string) {
  return apiDownload(`/api/leads/import-batches/${batchId}/report`, fileName);
}

export function summarizeBulkResult(
  result: BulkLeadResult,
  successMessage: (count: number) => string,
) {
  if (result.succeeded.length > 0) {
    toast.success(successMessage(result.succeeded.length));
  }
  if (result.failed.length > 0 && result.succeeded.length === 0) {
    toast.error(`All ${result.failed.length} operations failed`);
  } else if (result.failed.length > 0) {
    toast.info(`${result.failed.length} lead(s) could not be updated`);
  }
}
