"use client";

import { bulkSetUsersActive, summarizeBulkUserResult } from "@/lib/bulk-users";
import { getQueryClient } from "@/lib/queryClient";
import { toast } from "@/lib/toast";
import { useMutation } from "@tanstack/react-query";

export function useBulkUserActions() {
  const setActive = useMutation({
    mutationFn: ({ userIds, isActive }: { userIds: string[]; isActive: boolean }) =>
      bulkSetUsersActive(userIds, isActive),
    onSuccess: async (result, variables) => {
      await getQueryClient().invalidateQueries({ queryKey: ["users"] });
      summarizeBulkUserResult(result, (count) =>
        variables.isActive ? `Activated ${count} user(s)` : `Deactivated ${count} user(s)`,
      );
    },
    onError: () => toast.error("Failed to update user status"),
  });

  return {
    setActive,
    isBusy: setActive.isPending,
  };
}
