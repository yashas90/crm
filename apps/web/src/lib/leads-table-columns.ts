export type LeadsTableColumnId =
  | "name"
  | "assignedTo"
  | "source"
  | "status"
  | "score"
  | "project"
  | "actions";

export type LeadsColumnVisibility = Record<LeadsTableColumnId, boolean>;

export const LEADS_TABLE_COLUMNS: { id: LeadsTableColumnId; label: string }[] = [
  { id: "name", label: "Lead Name" },
  { id: "assignedTo", label: "Assigned To" },
  { id: "source", label: "Source" },
  { id: "status", label: "Status" },
  { id: "score", label: "Score" },
  { id: "project", label: "Project(s)" },
  { id: "actions", label: "Actions" },
];

export const DEFAULT_LEADS_COLUMN_VISIBILITY: LeadsColumnVisibility = {
  name: true,
  assignedTo: true,
  source: true,
  status: true,
  score: true,
  project: true,
  actions: true,
};

export function defaultLeadsColumnVisibility(): LeadsColumnVisibility {
  return { ...DEFAULT_LEADS_COLUMN_VISIBILITY };
}

export function visibleLeadsColumnCount(columns: LeadsColumnVisibility) {
  return LEADS_TABLE_COLUMNS.filter((column) => columns[column.id]).length;
}
