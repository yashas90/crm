"use client";

import { EmptyState } from "@/components/common/empty-state";
import { ProjectAvailabilitySwitch } from "@/components/projects/project-availability-switch";
import { ProjectDeleteDialog } from "@/components/projects/project-delete-dialog";
import { ProjectsTablePagination } from "@/components/projects/projects-table-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectRow } from "@/hooks/use-projects";
import { useToggleProjectAvailability } from "@/hooks/use-projects";
import { formatProjectCategory, getProjectStatusDisplay } from "@/lib/project-status-display";
import type { ProjectsColumnVisibility } from "@/lib/projects-table-columns";
import {
  DEFAULT_PROJECTS_COLUMN_VISIBILITY,
  visibleProjectsDataColumnCount,
} from "@/lib/projects-table-columns";
import { cn } from "@propninja/ui/lib/utils";
import { Building2, Copy, Eye, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, memo, useCallback, useMemo, useState } from "react";

const HEADER_CELL = "bg-slate-900 font-semibold text-slate-50";

type ProjectsTableProps = {
  projects: ProjectRow[];
  isLoading?: boolean;
  readOnly?: boolean;
  canManage?: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onAddProject?: () => void;
  columnsToShow?: ProjectsColumnVisibility;
};

type ActionIconButtonProps = {
  icon: ReactNode;
  label: string;
  className: string;
  onClick?: () => void;
  disabled?: boolean;
};

function ActionIconButton({ icon, label, className, onClick, disabled }: ActionIconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-white shadow-sm transition-opacity",
        className,
        disabled ? "cursor-not-allowed opacity-45" : "hover:opacity-90",
      )}
    >
      {icon}
    </button>
  );
}

function ProjectsTableSkeleton({
  rows,
  columnsToShow,
}: {
  rows: number;
  columnsToShow: ProjectsColumnVisibility;
}) {
  const colCount = 3 + visibleProjectsDataColumnCount(columnsToShow);

  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow key={`project-skeleton-${rowIndex}`}>
          {Array.from({ length: colCount }, (__, cellIndex) => (
            <TableCell key={`project-skeleton-${rowIndex}-${cellIndex}`}>
              <Skeleton className="h-5 w-full max-w-[10rem]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

type ProjectTableRowProps = {
  project: ProjectRow;
  index: number;
  readOnly: boolean;
  canManage: boolean;
  isSelected: boolean;
  columnsToShow: ProjectsColumnVisibility;
  onToggleSelect: (projectId: string) => void;
  onEdit: (projectId: string) => void;
  onView: (projectId: string) => void;
  onDelete: (project: ProjectRow) => void;
  onToggleAvailability: (projectId: string, availability: boolean) => void;
  isTogglingAvailability: boolean;
};

const ProjectTableRow = memo(function ProjectTableRow({
  project,
  index,
  readOnly,
  canManage,
  isSelected,
  columnsToShow,
  onToggleSelect,
  onEdit,
  onView,
  onDelete,
  onToggleAvailability,
  isTogglingAvailability,
}: ProjectTableRowProps) {
  const status = getProjectStatusDisplay(project.status);
  const actionsDisabled = readOnly || !canManage;

  return (
    <TableRow
      className={cn(
        "border-b transition-colors",
        index % 2 === 1 ? "bg-muted/15" : "bg-background",
        "hover:bg-primary/5",
        isSelected && "bg-primary/10",
      )}
    >
      <TableCell>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={isSelected}
          disabled={readOnly}
          onChange={() => onToggleSelect(project.id)}
          aria-label={`Select ${project.name}`}
        />
      </TableCell>
      {columnsToShow.availability ? (
        <TableCell>
          <ProjectAvailabilitySwitch
            checked={project.availability}
            disabled={actionsDisabled || isTogglingAvailability}
            label={`Toggle availability for ${project.name}`}
            onCheckedChange={(availability) => onToggleAvailability(project.id, availability)}
          />
        </TableCell>
      ) : null}
      <TableCell className="font-medium">{project.name}</TableCell>
      {columnsToShow.assignedTo ? (
        <TableCell className="text-sm">{project.assignedUser?.name ?? "—"}</TableCell>
      ) : null}
      {columnsToShow.projectType ? (
        <TableCell className="text-sm">{formatProjectCategory(project.projectCategory)}</TableCell>
      ) : null}
      {columnsToShow.status ? (
        <TableCell>
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
              status.className,
            )}
          >
            {status.label}
          </span>
        </TableCell>
      ) : null}
      <TableCell className="text-right">
        <div className="flex flex-wrap justify-end gap-1.5">
          <ActionIconButton
            icon={<Pencil className="h-3.5 w-3.5" />}
            label={`Edit ${project.name}`}
            className="bg-emerald-500"
            disabled={readOnly}
            onClick={() => onEdit(project.id)}
          />
          <ActionIconButton
            icon={<Eye className="h-3.5 w-3.5" />}
            label={`View ${project.name}`}
            className="bg-blue-500"
            onClick={() => onView(project.id)}
          />
          <ActionIconButton
            icon={<Copy className="h-3.5 w-3.5" />}
            label="Coming soon"
            className="bg-violet-500"
            disabled
          />
          <ActionIconButton
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label={`Delete ${project.name}`}
            className="bg-rose-500"
            disabled={actionsDisabled}
            onClick={() => onDelete(project)}
          />
        </div>
      </TableCell>
    </TableRow>
  );
});

export const ProjectsTable = memo(function ProjectsTable({
  projects,
  isLoading = false,
  readOnly = false,
  canManage = false,
  page,
  pageSize,
  total,
  onPageChange,
  selectedIds,
  onSelectionChange,
  onAddProject,
  columnsToShow = DEFAULT_PROJECTS_COLUMN_VISIBILITY,
}: ProjectsTableProps) {
  const router = useRouter();
  const toggleAvailability = useToggleProjectAvailability();
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const selectionControlled = selectedIds !== undefined && onSelectionChange !== undefined;
  const selected = selectionControlled ? selectedIds : internalSelected;
  const setSelected = selectionControlled ? onSelectionChange : setInternalSelected;

  const allOnPageSelected =
    projects.length > 0 && projects.every((project) => selected.includes(project.id));
  const showEmpty = !isLoading && projects.length === 0;

  const visibleIds = useMemo(() => new Set(projects.map((project) => project.id)), [projects]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleOne = useCallback(
    (projectId: string) => {
      setSelected(
        selectedSet.has(projectId)
          ? selected.filter((id) => id !== projectId)
          : [...selected, projectId],
      );
    },
    [selected, selectedSet, setSelected],
  );

  const toggleAllOnPage = useCallback(() => {
    if (allOnPageSelected) {
      setSelected(selected.filter((id) => !visibleIds.has(id)));
      return;
    }
    const merged = new Set(selected);
    for (const project of projects) {
      merged.add(project.id);
    }
    setSelected([...merged]);
  }, [allOnPageSelected, projects, selected, setSelected, visibleIds]);

  const handleEdit = useCallback(
    (projectId: string) => router.push(`/projects/${projectId}`),
    [router],
  );

  const handleView = useCallback(
    (projectId: string) => router.push(`/projects/${projectId}?view=1`),
    [router],
  );

  const handleToggleAvailability = useCallback(
    (projectId: string, availability: boolean) => {
      setTogglingId(projectId);
      toggleAvailability.mutate(
        { projectId, availability },
        { onSettled: () => setTogglingId(null) },
      );
    },
    [toggleAvailability],
  );

  if (showEmpty) {
    return (
      <EmptyState
        title={readOnly ? "No deleted projects" : "No projects yet"}
        description={
          readOnly
            ? "Archived projects will appear here."
            : "Create your first project to start organizing leads and inventory."
        }
        actionLabel={readOnly ? undefined : "Add Project"}
        onActionClick={readOnly ? undefined : onAddProject}
        icon={<Building2 className="h-7 w-7" />}
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-border/60">
          <div className="max-h-[calc(100vh-16rem)] overflow-auto">
            <Table aria-busy={isLoading} aria-label="Projects">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="border-0 bg-slate-900 hover:bg-slate-900">
                  <TableHead className={cn(HEADER_CELL, "w-10")}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={allOnPageSelected}
                      disabled={readOnly || projects.length === 0}
                      onChange={toggleAllOnPage}
                      aria-label="Select all projects on this page"
                    />
                  </TableHead>
                  {columnsToShow.availability ? (
                    <TableHead className={cn(HEADER_CELL, "w-28")}>Availability</TableHead>
                  ) : null}
                  <TableHead className={HEADER_CELL}>Project Name</TableHead>
                  {columnsToShow.assignedTo ? (
                    <TableHead className={HEADER_CELL}>Assigned To</TableHead>
                  ) : null}
                  {columnsToShow.projectType ? (
                    <TableHead className={HEADER_CELL}>Project Type</TableHead>
                  ) : null}
                  {columnsToShow.status ? (
                    <TableHead className={HEADER_CELL}>Status</TableHead>
                  ) : null}
                  <TableHead className={cn(HEADER_CELL, "text-right")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <ProjectsTableSkeleton rows={pageSize} columnsToShow={columnsToShow} />
                ) : (
                  projects.map((project, index) => (
                    <ProjectTableRow
                      key={project.id}
                      project={project}
                      index={index}
                      readOnly={readOnly}
                      canManage={canManage}
                      isSelected={selectedSet.has(project.id)}
                      columnsToShow={columnsToShow}
                      onToggleSelect={toggleOne}
                      onEdit={handleEdit}
                      onView={handleView}
                      onDelete={setDeleteTarget}
                      onToggleAvailability={handleToggleAvailability}
                      isTogglingAvailability={togglingId === project.id}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <ProjectsTablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
        />
      </div>

      {deleteTarget ? (
        <ProjectDeleteDialog
          projectId={deleteTarget.id}
          projectName={deleteTarget.name}
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        />
      ) : null}
    </>
  );
});
