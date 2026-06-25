"use client";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import type {
  ProjectBlocksInfo,
  ProjectGalleryInfo,
  ProjectUnitsInfo,
} from "@/lib/project-wizard-types";
import { toast } from "@/lib/toast";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
export { isForbiddenError } from "@/lib/query-errors";

export type ProjectRow = {
  id: string;
  name: string;
  status: string;
  projectType: string;
  projectCategory: string;
  subType: string | null;
  availability: boolean;
  description: string | null;
  assignedTo: string | null;
  assignedUser?: { id: string; name: string; email: string } | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDetail = ProjectRow & {
  facing: string[] | null;
  landArea: string | null;
  certificate: string | null;
  notes: string | null;
  builderName: string | null;
  builderPhone: string | null;
  builderContactName: string | null;
  builderContactPhone: string | null;
  reraNumbers: string[] | null;
  minPrice: string | null;
  maxPrice: string | null;
  brokeragePercent: string | null;
  startDate: string | null;
  endDate: string | null;
  possessionDate: string | null;
  unitsInfo: ProjectUnitsInfo | null;
  blocksInfo: ProjectBlocksInfo | null;
  amenities: string[] | null;
  gallery: ProjectGalleryInfo | null;
};

export type ProjectsListData = {
  items: ProjectRow[];
  page: number;
  pageSize: number;
  total: number;
};

export type ProjectScopeCounts = {
  all: number;
  deleted: number;
};

export type ProjectsQueryParams = {
  search?: string;
  category?: "residential" | "commercial" | "agricultural";
  statuses?: ProjectStatusValue[];
  assignedTo?: string;
  availability?: boolean;
  deletedOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export const PROJECTS_PAGE_SIZES = [10, 25, 50] as const;
export type ProjectsPageSize = (typeof PROJECTS_PAGE_SIZES)[number];

export type ProjectTypeValue = "residential" | "commercial" | "agricultural" | "plot" | "mixed";

export type ProjectStatusValue = "new" | "pre_launch" | "launch" | "ongoing" | "completed";

export type CreateProjectInput = {
  name: string;
  projectType: ProjectTypeValue;
  category?: "residential" | "commercial" | "agricultural";
  status?: ProjectStatusValue;
  subType?: string;
  landArea?: string;
  certificate?: string;
  facing?: string[];
  description?: string;
  notes?: string;
  builderName?: string;
  builderPhone?: string;
  builderContactName?: string;
  builderContactPhone?: string;
  reraNumbers?: string[];
  minPrice?: number;
  maxPrice?: number;
  brokeragePercent?: number;
  startDate?: string;
  endDate?: string;
  possessionDate?: string;
  availability?: boolean;
  assignedTo?: string | null;
  unitsInfo?: ProjectUnitsInfo;
  blocksInfo?: ProjectBlocksInfo;
  amenities?: string[];
  gallery?: ProjectGalleryInfo;
};

export type UpdateProjectPayload = {
  name?: string;
  projectType?: ProjectTypeValue;
  category?: "residential" | "commercial" | "agricultural";
  status?: ProjectStatusValue;
  subType?: string | null;
  landArea?: string | null;
  certificate?: string | null;
  facing?: string[] | null;
  description?: string | null;
  notes?: string | null;
  builderName?: string | null;
  builderPhone?: string | null;
  builderContactName?: string | null;
  builderContactPhone?: string | null;
  reraNumbers?: string[] | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  brokeragePercent?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  possessionDate?: string | null;
  availability?: boolean;
  assignedTo?: string | null;
  unitsInfo?: ProjectUnitsInfo | null;
  blocksInfo?: ProjectBlocksInfo | null;
  amenities?: string[] | null;
  gallery?: ProjectGalleryInfo | null;
  /** @deprecated Use availability */
  isActive?: boolean;
};

function buildProjectsQuery(params: ProjectsQueryParams) {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("pageSize", String(params.pageSize ?? 10));
  if (params.search) searchParams.set("search", params.search);
  if (params.category) searchParams.set("category", params.category);
  if (params.statuses && params.statuses.length > 0) {
    searchParams.set("statuses", params.statuses.join(","));
  }
  if (params.assignedTo) searchParams.set("assignedTo", params.assignedTo);
  if (params.availability !== undefined) {
    searchParams.set("availability", String(params.availability));
  }
  if (params.deletedOnly) searchParams.set("deletedOnly", "true");
  return `?${searchParams.toString()}`;
}

export function projectsListQueryKey(params: ProjectsQueryParams) {
  return [
    "projects",
    "list",
    params.search ?? null,
    params.category ?? null,
    params.statuses?.join(",") ?? null,
    params.assignedTo ?? null,
    params.availability ?? null,
    params.deletedOnly ?? false,
    params.page ?? 1,
    params.pageSize ?? 10,
  ] as const;
}

function projectsScopeCountsQueryKey(params: Pick<ProjectsQueryParams, "search" | "category">) {
  return ["projects", "scope-counts", params.search ?? null, params.category ?? null] as const;
}

/** Dropdown / filter helper — returns active projects (first 100). */
export function useProjects(options?: { search?: string; availability?: boolean }) {
  const params: ProjectsQueryParams = {
    search: options?.search,
    availability: options?.availability,
    page: 1,
    pageSize: 100,
  };

  const list = useProjectsList(params);
  return {
    ...list,
    data: list.data?.items,
  };
}

export function useProjectsList(params: ProjectsQueryParams, options?: { enabled?: boolean }) {
  const query = buildProjectsQuery(params);

  return useQuery({
    queryKey: projectsListQueryKey(params),
    queryFn: () => apiGet<ProjectsListData>(`/api/projects${query}`),
    enabled: options?.enabled !== false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useProjectScopeCounts(
  params: Pick<ProjectsQueryParams, "search" | "category">,
  options?: { enabled?: boolean },
) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.category) searchParams.set("category", params.category);
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";

  return useQuery({
    queryKey: projectsScopeCountsQueryKey(params),
    queryFn: () => apiGet<ProjectScopeCounts>(`/api/projects/scope-counts${query}`),
    enabled: options?.enabled !== false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useProject(projectId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => apiGet<ProjectDetail>(`/api/projects/${projectId}`),
    enabled: options?.enabled !== false && Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProjectInput) => apiPost<ProjectDetail>("/api/projects", payload),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.setQueryData(["projects", "detail", project.id], project);
      toast.success("Project created");
    },
    onError: () => toast.error("Failed to create project"),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      payload,
    }: {
      projectId: string;
      payload: UpdateProjectPayload;
    }) => apiPatch<ProjectDetail>(`/api/projects/${projectId}`, payload),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.setQueryData(["projects", "detail", project.id], project);
      toast.success("Project saved");
    },
    onError: () => toast.error("Failed to save project"),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => apiDelete<ProjectRow>(`/api/projects/${projectId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Project deleted");
    },
    onError: () => toast.error("Failed to delete project"),
  });
}

export function useToggleProjectAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      availability,
    }: {
      projectId: string;
      availability: boolean;
    }) => apiPost<ProjectRow>(`/api/projects/${projectId}/toggle-availability`, { availability }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: () => {
      toast.error("Could not update availability");
    },
  });
}
