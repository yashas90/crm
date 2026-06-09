import { apiPatch } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";

export type BulkUserResult = {
  succeeded: string[];
  failed: { id: string; message: string }[];
};

async function runBulk(
  userIds: string[],
  action: (userId: string) => Promise<void>,
  errorLabel: string,
): Promise<BulkUserResult> {
  const succeeded: string[] = [];
  const failed: BulkUserResult["failed"] = [];

  for (const id of userIds) {
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

export function bulkSetUsersActive(userIds: string[], isActive: boolean) {
  const label = isActive ? "Activate failed" : "Deactivate failed";
  return runBulk(userIds, (id) => apiPatch(`/api/users/${id}`, { isActive }), label);
}

export function summarizeBulkUserResult(
  result: BulkUserResult,
  successMessage: (count: number) => string,
) {
  if (result.succeeded.length > 0) {
    toast.success(successMessage(result.succeeded.length));
  }
  if (result.failed.length > 0 && result.succeeded.length === 0) {
    toast.error(`All ${result.failed.length} operations failed`);
  } else if (result.failed.length > 0) {
    toast.info(`${result.failed.length} user(s) could not be updated`);
  }
}
