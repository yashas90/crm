import { isQueuedOfflineError } from "@/lib/apiClient";
import { showGlobalToast } from "@/lib/toast";

/** Returns true when the error was handled as an offline queue save. */
export function handleMutationOfflineError(err: unknown): boolean {
  if (isQueuedOfflineError(err)) {
    showGlobalToast(err instanceof Error ? err.message : "Saved offline.");
    return true;
  }
  return false;
}
