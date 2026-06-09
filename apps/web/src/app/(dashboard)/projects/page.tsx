"use client";

import { EmptyState } from "@/components/common/empty-state";
import { QuickFilterTabs } from "@/components/common/quick-filter-tabs";
import { ProjectsFilterDrawer } from "@/components/projects/projects-filter-drawer";
import { ProjectsListToolbar } from "@/components/projects/projects-list-toolbar";
import { ProjectsTable } from "@/components/projects/projects-table";
import {
  PROJECTS_PAGE_SIZES,
  type ProjectsPageSize,
  useProjectScopeCounts,
  useProjectsList,
} from "@/hooks/use-projects";
import { useSession } from "@/hooks/use-session";
import {
  type ProjectsListFilters,
  countActiveProjectsFilters,
  defaultProjectsListFilters,
  projectsAvailabilityToQuery,
} from "@/lib/projects-list-filters";
import {
  type ProjectsColumnVisibility,
  defaultProjectsColumnVisibility,
} from "@/lib/projects-table-columns";
import { getQueryClient } from "@/lib/queryClient";
import { Button } from "@propninja/ui/button";
import { AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ProjectScope = "all" | "deleted";

type ProjectCategory = "all" | "residential" | "commercial" | "agricultural";

const SCOPE_TABS: { id: ProjectScope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "deleted", label: "Deleted" },
];

const CATEGORY_TABS: { id: ProjectCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "residential", label: "Residential" },
  { id: "commercial", label: "Commercial" },
  { id: "agricultural", label: "Agricultural" },
];

const SEARCH_DEBOUNCE_MS = 300;

export default function ProjectsPage() {
  const router = useRouter();
  const { ready, isAdmin, isManager } = useSession();
  const canManage = isAdmin || isManager;

  const [scope, setScope] = useState<ProjectScope>("all");
  const [category, setCategory] = useState<ProjectCategory>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<ProjectsPageSize>(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [columns, setColumns] = useState<ProjectsColumnVisibility>(defaultProjectsColumnVisibility);
  const [appliedFilters, setAppliedFilters] = useState<ProjectsListFilters>(
    defaultProjectsListFilters,
  );
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchDraft.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [scope, category, search, pageSize, appliedFilters]);

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      category: category === "all" ? undefined : category,
      statuses: appliedFilters.statuses.length > 0 ? appliedFilters.statuses : undefined,
      assignedTo: appliedFilters.assignedTo || undefined,
      availability: projectsAvailabilityToQuery(appliedFilters.availability),
      deletedOnly: scope === "deleted",
      page,
      pageSize,
    }),
    [search, category, scope, page, pageSize, appliedFilters],
  );

  const scopeCountParams = useMemo(
    () => ({
      search: search || undefined,
      category: category === "all" ? undefined : category,
    }),
    [search, category],
  );

  const listQuery = useProjectsList(listParams, { enabled: ready });
  const scopeCounts = useProjectScopeCounts(scopeCountParams, { enabled: ready });

  const tableLoading = !listQuery.data && (listQuery.isLoading || listQuery.isFetching);
  const projects = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const activeFilterCount = countActiveProjectsFilters(appliedFilters);

  const scopeTabCounts = useMemo(
    () => ({
      all: scopeCounts.data?.all ?? 0,
      deleted: scopeCounts.data?.deleted ?? 0,
    }),
    [scopeCounts.data],
  );

  function handleRetry() {
    void getQueryClient().invalidateQueries({ queryKey: ["projects"] });
  }

  function handleSearchSubmit() {
    setSearch(searchDraft.trim());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Projects</h1>
          <p className="text-sm text-muted-foreground">
            Browse, filter, and manage your project catalog.
          </p>
        </div>
        {canManage ? (
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Project
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="space-y-3">
        <QuickFilterTabs
          tabs={SCOPE_TABS}
          value={scope}
          onChange={setScope}
          counts={scopeTabCounts}
          isLoadingCounts={scopeCounts.isLoading && !scopeCounts.data}
          variant="pill"
          ariaLabel="Project scope"
        />

        <QuickFilterTabs
          tabs={CATEGORY_TABS}
          value={category}
          onChange={setCategory}
          variant="chip"
          ariaLabel="Project category"
        />

        <ProjectsListToolbar
          searchDraft={searchDraft}
          onSearchDraftChange={setSearchDraft}
          onSearchSubmit={handleSearchSubmit}
          columns={columns}
          onColumnsChange={setColumns}
          onOpenFilters={() => setFilterDrawerOpen(true)}
          activeFilterCount={activeFilterCount}
          pageSize={pageSize}
          onPageSizeChange={(size) => setPageSize(size as ProjectsPageSize)}
          pageSizeOptions={PROJECTS_PAGE_SIZES}
        />
      </div>

      <ProjectsFilterDrawer
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        applied={appliedFilters}
        onApply={setAppliedFilters}
      />

      {listQuery.isError ? (
        <EmptyState
          title="Unable to load projects"
          description="The project list could not be loaded. Check your connection and try again."
          actionLabel="Retry"
          onActionClick={handleRetry}
          icon={<AlertCircle className="h-7 w-7 text-destructive" />}
        />
      ) : (
        <ProjectsTable
          projects={projects}
          isLoading={tableLoading}
          readOnly={scope === "deleted"}
          canManage={canManage}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onAddProject={() => router.push("/projects/new")}
          columnsToShow={columns}
        />
      )}
    </div>
  );
}
