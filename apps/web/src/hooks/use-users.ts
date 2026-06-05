"use client";

import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
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

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: "manager" | "agent";
  phone?: string;
};

export type UpdateUserPayload = {
  name?: string;
  email?: string;
  phone?: string | null;
  role?: string;
  isActive?: boolean;
  password?: string;
};

export function useUsers(role?: string) {
  const query = role ? `?role=${role}&pageSize=100` : "?pageSize=100";

  return useQuery({
    queryKey: ["users", role ?? "all"],
    queryFn: () => apiGet<UserRow[]>(`/api/users${query}`),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateUserInput) => apiPost<UserRow>("/api/users", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created");
    },
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
      payload: UpdateUserPayload;
    }) => apiPatch<UserRow>(`/api/users/${userId}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
    },
  });
}
