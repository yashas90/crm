import { apiDelete, apiPatch, apiPost } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import type { BulkLeadImportRow } from "@/lib/parse-leads-csv";
import { toast } from "@/lib/toast";
import type { LeadStatus } from "@propninja/types/enums";

export type BulkLeadResult = {
  succeeded: string[];
  failed: { id: string; message: string }[];
};

async function runBulk(
  leadIds: string[],
  action: (leadId: string) => Promise<void>,
  errorLabel: string,
): Promise<BulkLeadResult> {
  const succeeded: string[] = [];
  const failed: BulkLeadResult["failed"] = [];

  for (const id of leadIds) {
    try {
      await action(id);
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

export function bulkAssignLeads(leadIds: string[], userId: string) {
  return runBulk(
    leadIds,
    (id) => apiPost(`/api/leads/${id}/assign`, { user_id: userId }),
    "Assign failed",
  );
}

export function bulkDeleteLeads(leadIds: string[]) {
  return runBulk(leadIds, (id) => apiDelete(`/api/leads/${id}`), "Archive failed");
}

export type BulkImportLeadsResult = {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  created: { row: number; id: string; phone: string }[];
  updated: { row: number; id: string; phone: string }[];
  skipped: { row: number; phone: string; reason: string }[];
  failed: { row: number; message: string }[];
};

export function bulkImportLeads(input: {
  leads: BulkLeadImportRow[];
  skipDuplicates?: boolean;
  assignToUserId?: string;
}) {
  return apiPost<BulkImportLeadsResult>("/api/leads/bulk-import", input);
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
