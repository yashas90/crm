"use client";

import { apiDownload, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { SILENT_QUERY_ERROR_META } from "@/lib/query-meta";
import { toast } from "@/lib/toast";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
export { isForbiddenError } from "@/lib/query-errors";

export type UserRow = {
  id: string;
  username: string;
  name: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  workEmail: string | null;
  workPhone: string | null;
  personalPhone: string | null;
  homeLocation: string | null;
  department: string | null;
  designation: string | null;
  timeZone: string | null;
  brokerNumber: string | null;
  description: string | null;
  roleLabel: string | null;
  generalManagerId: string | null;
  reportingToId: string | null;
  role: string;
  phone: string | null;
  isActive: boolean;
  isFirstLogin?: boolean;
  isLastAdmin?: boolean;
  createdAt: string;
};

export type UsersListData = {
  items: UserRow[];
  page: number;
  pageSize: number;
  total: number;
};

export type UserScopeCounts = {
  all: number;
  active: number;
  inactive: number;
};

export type UserStatusFilter = "all" | "active" | "inactive";

export type UsersQueryParams = {
  search?: string;
  status?: UserStatusFilter;
  role?: string;
  page?: number;
  pageSize?: number;
};

export const USERS_PAGE_SIZES = [10, 25, 50] as const;
export type UsersPageSize = (typeof USERS_PAGE_SIZES)[number];

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: "agent" | "manager" | "admin";
  isActive?: boolean;
  /** Legacy fields */
  username?: string;
  roleLabel?: string;
  workEmail?: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  workPhone?: string | null;
  personalPhone?: string | null;
  homeLocation?: string | null;
  department?: string | null;
  designation?: string | null;
  timeZone?: string;
  brokerNumber?: string | null;
  description?: string | null;
  generalManagerId?: string | null;
  reportingToId?: string | null;
};

export type UpdateUserPayload = {
  username?: string;
  name?: string;
  email?: string;
  phone?: string | null;
  roleLabel?: string | null;
  role?: string;
  isActive?: boolean;
  firstName?: string | null;
  lastName?: string | null;
  workEmail?: string | null;
  workPhone?: string | null;
  personalPhone?: string | null;
  homeLocation?: string | null;
  department?: string | null;
  designation?: string | null;
  timeZone?: string | null;
  brokerNumber?: string | null;
  description?: string | null;
  generalManagerId?: string | null;
  reportingToId?: string | null;
};

function buildUsersQuery(params: UsersQueryParams) {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("pageSize", String(params.pageSize ?? 10));
  if (params.search) searchParams.set("search", params.search);
  if (params.status && params.status !== "all") {
    searchParams.set("status", params.status);
  }
  if (params.role) searchParams.set("role", params.role);
  return `?${searchParams.toString()}`;
}

export function usersListQueryKey(params: UsersQueryParams) {
  return [
    "users",
    "list",
    params.search ?? null,
    params.status ?? "all",
    params.role ?? null,
    params.page ?? 1,
    params.pageSize ?? 10,
  ] as const;
}

function usersScopeCountsQueryKey(search?: string) {
  return ["users", "scope-counts", search ?? null] as const;
}

/** Dropdown helper — returns up to 100 users. */
export function useUsers(role?: string, options?: { enabled?: boolean }) {
  const list = useUsersList(
    { role, status: "all", page: 1, pageSize: 100 },
    { enabled: options?.enabled },
  );
  return {
    ...list,
    data: list.data?.items,
  };
}

export function useUsersList(params: UsersQueryParams, options?: { enabled?: boolean }) {
  const query = buildUsersQuery(params);

  return useQuery({
    queryKey: usersListQueryKey(params),
    queryFn: () => apiGet<UsersListData>(`/api/users${query}`),
    enabled: options?.enabled !== false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    meta: SILENT_QUERY_ERROR_META,
  });
}

export function useUserScopeCounts(search?: string, options?: { enabled?: boolean }) {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";

  return useQuery({
    queryKey: usersScopeCountsQueryKey(search),
    queryFn: () => apiGet<UserScopeCounts>(`/api/users/scope-counts${query}`),
    enabled: options?.enabled !== false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useUser(userId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["users", "detail", userId],
    queryFn: () => apiGet<UserRow>(`/api/users/${userId}`),
    enabled: options?.enabled !== false && Boolean(userId),
    staleTime: 30_000,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateUserInput) => apiPost<UserRow>("/api/users", payload),
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(`User ${user.name} created successfully`);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to create user")),
  });
}

export type UsersExportParams = {
  search?: string;
  status?: UserStatusFilter;
};

export async function downloadUsersExport(params: UsersExportParams) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.status && params.status !== "all") {
    searchParams.set("status", params.status);
  }
  const query = searchParams.toString();
  const date = new Date().toISOString().slice(0, 10);
  await apiDownload(`/api/users/export${query ? `?${query}` : ""}`, `users-${date}.csv`);
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
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.setQueryData(["users", "detail", user.id], user);
      toast.success("User updated");
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to update user")),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({
      userId,
      newPassword,
    }: {
      userId: string;
      newPassword: string;
      userName?: string;
    }) => apiPatch<UserRow>(`/api/users/${userId}/password`, { newPassword }),
    onSuccess: (_user, variables) => {
      toast.success(`Password updated for ${variables.userName ?? "user"}`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to reset password"));
    },
  });
}
