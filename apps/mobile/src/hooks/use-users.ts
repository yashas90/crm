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

function useAuthReady() {
  const { status } = useAuth();
  return status === "authenticated";
}

export function useUsers(filters?: { role?: UserRole; status?: "active" | "inactive" | "all" }) {
  const ready = useAuthReady();
  const params = new URLSearchParams({
    page: "1",
    pageSize: "100",
    status: filters?.status ?? "all",
  });
  if (filters?.role) params.set("role", filters.role);

  return useQuery({
    queryKey: ["users", params.toString()],
    queryFn: () => apiGet<UsersPage>(`/api/users?${params.toString()}`),
    enabled: ready,
  });
}

export function useTeamMembers() {
  return useUsers({ status: "active" });
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
