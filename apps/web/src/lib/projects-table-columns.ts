export type ProjectsTableColumnId = "availability" | "assignedTo" | "projectType" | "status";

export type ProjectsColumnVisibility = Record<ProjectsTableColumnId, boolean>;

export const PROJECTS_TABLE_COLUMNS: { id: ProjectsTableColumnId; label: string }[] = [
  { id: "availability", label: "Availability" },
  { id: "assignedTo", label: "Assigned To" },
  { id: "projectType", label: "Project Type" },
  { id: "status", label: "Status" },
];

export const DEFAULT_PROJECTS_COLUMN_VISIBILITY: ProjectsColumnVisibility = {
  availability: true,
  assignedTo: true,
  projectType: true,
  status: true,
};

export function defaultProjectsColumnVisibility(): ProjectsColumnVisibility {
  return { ...DEFAULT_PROJECTS_COLUMN_VISIBILITY };
}

export function visibleProjectsDataColumnCount(columns: ProjectsColumnVisibility) {
  return PROJECTS_TABLE_COLUMNS.filter((column) => columns[column.id]).length;
}
