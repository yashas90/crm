"use client";

import { apiGet, apiPatch } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
// User list is readable by all roles; PATCH requires admin (enforced server-side).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
export { isForbiddenError } from "@/lib/query-errors";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
};

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<UserRow[]>("/api/users"),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string;
      payload: { role?: string; isActive?: boolean };
    }) => apiPatch<UserRow>(`/api/users/${userId}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
    },
  });
}
