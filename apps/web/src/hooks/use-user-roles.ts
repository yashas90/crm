"use client";

import { apiGet } from "@/lib/apiClient";
import { FALLBACK_USER_ROLES } from "@/lib/user-form-schema";
import { useQuery } from "@tanstack/react-query";

export type UserRoleGroup = {
  id: string;
  name: string;
  permissions: string[];
};

export function useUserRoles(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      try {
        return await apiGet<UserRoleGroup[]>("/api/user-roles");
      } catch {
        return FALLBACK_USER_ROLES.map((role) => ({
          ...role,
          permissions: [...role.permissions],
        }));
      }
    },
    enabled: options?.enabled !== false,
    staleTime: 60_000,
    initialData: FALLBACK_USER_ROLES.map((role) => ({
      ...role,
      permissions: [...role.permissions],
    })),
  });
}
