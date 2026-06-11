"use client";

import { EmptyState } from "@/components/common/empty-state";
import { LeadEditModal } from "@/components/leads/lead-edit-modal";
import { LeadForm } from "@/components/leads/lead-form";
import { LeadsAdvancedFiltersSheet } from "@/components/leads/leads-advanced-filters-sheet";
import {
  type BulkActionIntent,
  LeadsBulkActionsBar,
} from "@/components/leads/leads-bulk-actions-bar";
import { LeadsBulkImportDialog } from "@/components/leads/leads-bulk-import-dialog";
import { LeadsListFilters } from "@/components/leads/leads-list-filters";
import { LeadsPageHeaderActions } from "@/components/leads/leads-page-header-actions";
import { LeadsTable } from "@/components/leads/leads-table";
import {
  type LeadRow,
  leadsListQueryKey,
  useLeadScopeCounts,
  useLeadStageCounts,
  useLeads,
} from "@/hooks/use-leads";
import { usePermissions } from "@/hooks/use-permissions";
import { useSession } from "@/hooks/use-session";
import { formatLeadSourceDisplay } from "@/lib/lead-sources";
import { type LeadsDatePreset, resolveLeadsDatePreset } from "@/lib/leads-date-filters";
import type { LeadsScope } from "@/lib/leads-scope";
import type { LeadsStage } from "@/lib/leads-stage";
import {
  type LeadsColumnVisibility,
  defaultLeadsColumnVisibility,
} from "@/lib/leads-table-columns";
import {
  LEADS_PAGE_SIZE,
  type LeadsUrlFilters,
  buildLeadsSearchParams,
  countAdvancedLeadsFilters,
  defaultLeadsUrlFilters,
  leadsBaseFiltersToQuery,
  leadsFiltersToQuery,
  leadsSharedFiltersToQuery,
  parseLeadsPageUrl,
} from "@/lib/leads-url-filters";
import { getQueryClient } from "@/lib/queryClient";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { AlertCircle, Upload } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function LeadsPageView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const skipUrlWriteRef = useRef(false);

  const [filters, setFilters] = useState<LeadsUrlFilters>(
    () => parseLeadsPageUrl(searchParams).filters,
  );
  const [searchDraft, setSearchDraft] = useState(
    () => parseLeadsPageUrl(searchParams).filters.search,
  );
  const [scope, setScope] = useState<LeadsScope>(() => parseLeadsPageUrl(searchParams).scope);
  const [stage, setStage] = useState<LeadsStage>(() => parseLeadsPageUrl(searchParams).stage);
  const [columns, setColumns] = useState<LeadsColumnVisibility>(defaultLeadsColumnVisibility);
  const [page, setPage] = useState(1);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const { canBulkUploadLeads } = usePermissions();
  const [editingLead, setEditingLead] = useState<LeadRow | null>(null);
  const [bulkHint, setBulkHint] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkActionIntent | null>(null);
  const bulkBarRef = useRef<HTMLDivElement>(null);

  const { session, ready } = useSession();

  useEffect(() => {
    skipUrlWriteRef.current = true;
    const parsed = parseLeadsPageUrl(searchParams);
    setFilters(parsed.filters);
    setSearchDraft(parsed.filters.search);
    setScope(parsed.scope);
    setStage(parsed.stage);
  }, [searchParams]);

  useEffect(() => {
    if (skipUrlWriteRef.current) {
      skipUrlWriteRef.current = false;
      return;
    }

    const nextQuery = buildLeadsSearchParams(filters, { scope, stage });
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return;

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [filters, scope, stage, pathname, router, searchParams]);

  const listEnabled = ready && (scope !== "my" || Boolean(session?.id));

  const sharedFiltersQuery = useMemo(() => leadsSharedFiltersToQuery(filters), [filters]);

  const baseQuery = useMemo(
    () =>
      leadsBaseFiltersToQuery(filters, {
        scope,
        userId: ready && session ? session.id : undefined,
      }),
    [filters, scope, ready, session],
  );

  const leadsQuery = useMemo(
    () =>
      leadsFiltersToQuery(filters, {
        scope,
        stage,
        page,
        userId: ready && session ? session.id : undefined,
      }),
    [filters, scope, stage, page, ready, session],
  );

  useEffect(() => {
    setPage(1);
    setSelectedLeadIds([]);
    setBulkHint(false);
  }, [filters, scope, stage]);

  useEffect(() => {
    if (selectedLeadIds.length > 0) {
      setBulkHint(false);
    }
  }, [selectedLeadIds.length]);

  function handlePageUpdateClick() {
    bulkBarRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (selectedLeadIds.length > 0) {
      setPendingBulkAction("status");
    } else {
      setBulkHint(true);
    }
  }

  const { data, isLoading, isError, isFetching } = useLeads(leadsQuery, {
    enabled: listEnabled,
    suppressErrorToast: true,
  });

  const scopeCounts = useLeadScopeCounts(sharedFiltersQuery, { enabled: listEnabled });
  const stageCounts = useLeadStageCounts(baseQuery, { enabled: listEnabled });

  const scopeCountsLoading = scopeCounts.isLoading && !scopeCounts.data;
  const stageCountsLoading = stageCounts.isLoading && !stageCounts.data;
  const tableLoading = !data && (isLoading || isFetching);

  const handleRetryLeads = useCallback(() => {
    void getQueryClient().invalidateQueries({ queryKey: leadsListQueryKey(leadsQuery) });
  }, [leadsQuery]);

  const displayLeads = data?.items ?? [];
  const advancedFilterCount = countAdvancedLeadsFilters(filters);

  const handleSearchSubmit = () => {
    setFilters((current) => ({ ...current, search: searchDraft.trim() }));
  };

  const handleDatePresetChange = (
    preset: LeadsDatePreset,
    range?: { from?: string; to?: string },
  ) => {
    const resolved = resolveLeadsDatePreset(
      preset,
      range?.from ?? filters.dateFrom,
      range?.to ?? filters.dateTo,
    );

    setFilters((current) => ({
      ...current,
      datePreset: preset,
      dateFrom: resolved.dateFrom,
      dateTo: resolved.dateTo,
    }));
  };

  useEffect(() => {
    function openNewLead() {
      setShowForm(true);
    }
    window.addEventListener("propninja:open-new-lead", openNewLead);
    return () => window.removeEventListener("propninja:open-new-lead", openNewLead);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Leads</h2>
            <p className="text-muted-foreground">Search, filter, and manage your pipeline.</p>
          </div>
          <LeadsPageHeaderActions onUpdateClick={handlePageUpdateClick} />
        </div>
        <div className="flex gap-2">
          {canBulkUploadLeads ? (
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import leads
            </Button>
          ) : null}
          <Button onClick={() => setShowForm(true)}>Add Lead</Button>
        </div>
      </div>

      <LeadsListFilters
        scope={scope}
        onScopeChange={setScope}
        scopeCounts={scopeCounts.data}
        scopeCountsLoading={scopeCountsLoading}
        stage={stage}
        onStageChange={setStage}
        stageCounts={stageCounts.data}
        stageCountsLoading={stageCountsLoading}
        searchDraft={searchDraft}
        onSearchDraftChange={setSearchDraft}
        onSearchSubmit={handleSearchSubmit}
        filters={filters}
        onDatePresetChange={handleDatePresetChange}
        columns={columns}
        onColumnsChange={setColumns}
        onOpenAdvancedFilters={() => setAdvancedOpen(true)}
        advancedFilterCount={advancedFilterCount}
        onAdLeadsOnlyChange={(adLeadsOnly) =>
          setFilters((current) => ({
            ...current,
            adLeadsOnly,
            source: adLeadsOnly ? "" : current.source,
          }))
        }
      />

      {showForm ? (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Create lead</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadForm
              onSuccess={() => {
                setShowForm(false);
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {filters.adLeadsOnly ||
      filters.source ||
      (filters.datePreset !== "all" && filters.dateFrom) ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {filters.adLeadsOnly ? (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-800 dark:text-emerald-300">
              Ad Leads
            </span>
          ) : null}
          {filters.source ? (
            <span className="rounded-full bg-sky-500/10 px-2.5 py-1 font-medium text-sky-800 dark:text-sky-300">
              Source: {formatLeadSourceDisplay(filters.source)}
            </span>
          ) : null}
          {filters.datePreset !== "all" && filters.dateFrom ? (
            <span className="rounded-full bg-violet-500/10 px-2.5 py-1 font-medium text-violet-800 dark:text-violet-300">
              Created {filters.dateFrom}
              {filters.dateTo && filters.dateTo !== filters.dateFrom
                ? ` ΓåÆ ${filters.dateTo}`
                : ""}
            </span>
          ) : null}
        </div>
      ) : null}

      <LeadsBulkActionsBar
        ref={bulkBarRef}
        selectedIds={selectedLeadIds}
        onClearSelection={() => setSelectedLeadIds([])}
        showHint={bulkHint}
        onDismissHint={() => setBulkHint(false)}
        pendingAction={pendingBulkAction}
        onPendingActionHandled={() => setPendingBulkAction(null)}
      />

      {isError && !data ? (
        <EmptyState
          title="Could not load leads."
          description="Check your connection and try again."
          actionLabel="Retry"
          onActionClick={handleRetryLeads}
          icon={<AlertCircle className="h-7 w-7" />}
          className="py-10"
        />
      ) : (
        <section aria-label="Leads results">
          <p className="text-sm text-muted-foreground">
            {data ? (
              <>
                {data.total} leads
                {isFetching && !tableLoading ? (
                  <span className="ml-2 text-xs text-muted-foreground">UpdatingΓÇª</span>
                ) : null}
              </>
            ) : (
              "Loading leadsΓÇª"
            )}
          </p>
          <LeadsTable
            leads={displayLeads}
            isLoading={tableLoading}
            columnsToShow={columns}
            page={page}
            pageSize={LEADS_PAGE_SIZE}
            total={data?.total ?? 0}
            onPageChange={setPage}
            selectedIds={selectedLeadIds}
            onSelectionChange={setSelectedLeadIds}
            onEdit={setEditingLead}
            onAddLead={() => setShowForm(true)}
          />
        </section>
      )}

      <LeadsAdvancedFiltersSheet
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        filters={filters}
        onApply={setFilters}
        onStageChange={setStage}
      />

      <LeadEditModal
        lead={editingLead}
        open={Boolean(editingLead)}
        onOpenChange={(open) => {
          if (!open) setEditingLead(null);
        }}
      />

      <LeadsBulkImportDialog
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImported={() => {
          setPage(1);
          setScope("all");
          setStage("active");
          setSearchDraft("");
          setFilters(defaultLeadsUrlFilters());
          setSelectedLeadIds([]);
          void getQueryClient().invalidateQueries({ queryKey: ["leads"] });
        }}
      />
    </div>
  );
}
