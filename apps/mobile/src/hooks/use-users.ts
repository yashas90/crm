import { apiGet, apiPatch } from "@/lib/apiClient";
import { useAuth } from "@/providers/auth-provider";
import type { UserRole } from "@propninja/types/permissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type OrgUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
};

type UsersPage = {
  items: OrgUser[];
  page: number;
  pageSize: number;
  total: number;
};

export function useUsers(
  filters?: { role?: UserRole; status?: "active" | "inactive" | "all" },
  options?: { enabled?: boolean },
) {
  const { user, status } = useAuth();
  const ready = status === "authenticated";
  const canListUsers = user?.role === "admin" || user?.role === "manager";
  const params = new URLSearchParams({
    page: "1",
    pageSize: "100",
    status: filters?.status ?? "all",
  });
  if (filters?.role) params.set("role", filters.role);

  return useQuery({
    queryKey: ["users", params.toString()],
    queryFn: () => apiGet<UsersPage>(`/api/users?${params.toString()}`),
    enabled: ready && canListUsers && (options?.enabled ?? true),
    staleTime: 5 * 60_000,
    meta: { suppressErrorToast: true },
  });
}

export function useTeamMembers(options?: { enabled?: boolean }) {
  return useUsers({ status: "active" }, options);
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string;
      payload: { role?: UserRole; isActive?: boolean };
    }) => apiPatch<OrgUser>(`/api/users/${userId}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
