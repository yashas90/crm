import type { ProjectStatusValue } from "@/hooks/use-projects";

export type ProjectsAvailabilityFilter = "all" | "available" | "unavailable";

export type ProjectsListFilters = {
  statuses: ProjectStatusValue[];
  assignedTo: string;
  availability: ProjectsAvailabilityFilter;
};

export const PROJECT_STATUS_FILTER_OPTIONS: {
  value: ProjectStatusValue;
  label: string;
}[] = [
  { value: "new", label: "New" },
  { value: "pre_launch", label: "Pre Launch" },
  { value: "launch", label: "Launch" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
];

export function defaultProjectsListFilters(): ProjectsListFilters {
  return {
    statuses: [],
    assignedTo: "",
    availability: "all",
  };
}

export function countActiveProjectsFilters(filters: ProjectsListFilters): number {
  let count = 0;
  if (filters.statuses.length > 0) count += 1;
  if (filters.assignedTo) count += 1;
  if (filters.availability !== "all") count += 1;
  return count;
}

export function projectsAvailabilityToQuery(
  availability: ProjectsAvailabilityFilter,
): boolean | undefined {
  if (availability === "available") return true;
  if (availability === "unavailable") return false;
  return undefined;
}
