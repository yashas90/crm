"use client";

import { CallsListTable } from "@/components/calls/calls-list-table";
import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { EmptyState } from "@/components/common/empty-state";
import { QuickFilterTabs } from "@/components/common/quick-filter-tabs";
import { BarChart } from "@/components/reports/bar-chart";
import { CallLogsReportPanel } from "@/components/reports/call-logs-report-panel";
import { CallsFilterDrawer } from "@/components/reports/calls-filter-drawer";
import { CallsUserReportTable } from "@/components/reports/calls-user-report-table";
import { LineAreaChart } from "@/components/reports/line-area-chart";
import { PieChart } from "@/components/reports/pie-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCalls } from "@/hooks/use-leads";
import { usePermissions } from "@/hooks/use-permissions";
import {
  CALLS_REPORT_PAGE_SIZES,
  type CallsReportPageSize,
  type CallsUserStatusFilter,
  downloadCallsAnalyticsReport,
  downloadCallsUserReport,
  isForbiddenError,
  useCallsReport,
  useCallsUserReport,
} from "@/hooks/use-reports";
import {
  type CallsReportFilterState,
  callsReportFiltersToApiRange,
  callsReportFiltersToQueryParams,
  countActiveCallsReportFilters,
  defaultCallsReportFilters,
  resolveCallsReportDates,
} from "@/lib/calls-report-filters";
import { toApiRange } from "@/lib/report-filters";
import { CALL_OUTCOME_LABELS, type CallOutcome } from "@propninja/types/enums";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { AlertCircle, Download, Filter, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const USER_STATUS_TABS: { id: CallsUserStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

const USER_NAME_SEARCH_DEBOUNCE_MS = 300;

export default function CallsReportPage() {
  const { canViewReports, isManager, ready } = usePermissions();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [userReportPage, setUserReportPage] = useState(1);
  const [userReportPageSize, setUserReportPageSize] = useState<CallsReportPageSize>(50);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingAnalytics, setIsExportingAnalytics] = useState(false);
  const [userStatus, setUserStatus] = useState<CallsUserStatusFilter>("all");
  const [userNameDraft, setUserNameDraft] = useState("");
  const [userNameSearch, setUserNameSearch] = useState("");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] =
    useState<CallsReportFilterState>(defaultCallsReportFilters);
  const detailsRef = useRef<HTMLDivElement>(null);

  const apiRange = useMemo(() => callsReportFiltersToApiRange(appliedFilters), [appliedFilters]);
  const labelRange = useMemo(() => resolveCallsReportDates(appliedFilters), [appliedFilters]);
  const activeFilterCount = useMemo(
    () => countActiveCallsReportFilters(appliedFilters),
    [appliedFilters],
  );

  const reportQueryParams = useMemo(
    () => ({
      dateFrom: apiRange.dateFrom,
      dateTo: apiRange.dateTo,
      ...callsReportFiltersToQueryParams(appliedFilters),
      userStatus,
      userName: userNameSearch,
      page: userReportPage,
      pageSize: userReportPageSize,
    }),
    [
      apiRange.dateFrom,
      apiRange.dateTo,
      appliedFilters,
      userStatus,
      userNameSearch,
      userReportPage,
      userReportPageSize,
    ],
  );

  const userReport = useCallsUserReport(reportQueryParams, { enabled: ready && canViewReports });
  const analyticsReport = useCallsReport(
    {
      dateFrom: apiRange.dateFrom,
      dateTo: apiRange.dateTo,
      ...callsReportFiltersToQueryParams(appliedFilters),
    },
    { enabled: ready && canViewReports },
  );

  const detailRange = selectedDate
    ? toApiRange(selectedDate, selectedDate)
    : { dateFrom: apiRange.dateFrom, dateTo: apiRange.dateTo };

  const callsList = useCalls({
    user_id: appliedFilters.userIds.length === 1 ? appliedFilters.userIds[0] : undefined,
    date_from: detailRange.dateFrom,
    date_to: detailRange.dateTo,
    page: "1",
    pageSize: "100",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUserNameSearch(userNameDraft.trim());
    }, USER_NAME_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [userNameDraft]);

  useEffect(() => {
    setUserReportPage(1);
  }, [
    apiRange.dateFrom,
    apiRange.dateTo,
    userStatus,
    userNameSearch,
    appliedFilters,
    userReportPageSize,
  ]);

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadCallsUserReport(reportQueryParams);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportAnalytics() {
    setIsExportingAnalytics(true);
    try {
      await downloadCallsAnalyticsReport({
        dateFrom: apiRange.dateFrom,
        dateTo: apiRange.dateTo,
        userIds: appliedFilters.userIds.length > 0 ? appliedFilters.userIds : undefined,
        withTeam: appliedFilters.withTeam,
      });
    } finally {
      setIsExportingAnalytics(false);
    }
  }

  useEffect(() => {
    if (selectedDate && detailsRef.current) {
      detailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedDate]);

  const showTeamReport = ready && canViewReports;
  const showUserReport = showTeamReport && userReport.data;
  const showAnalytics = showTeamReport && analyticsReport.data;
  const reportTitle = !ready
    ? "Call report"
    : showTeamReport
      ? isManager
        ? "Team call report"
        : "Leads – Call Report"
      : "My calls";

  return (
    <div className="space-y-4">
      <div>
        {!showTeamReport ? null : (
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/reports" className="hover:text-foreground hover:underline">
              Reports
            </Link>
            <span className="mx-2 text-muted-foreground/70">/</span>
            <span className="text-foreground">
              {isManager ? "Team call report" : "Leads – Call Report"}
            </span>
          </nav>
        )}
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{reportTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {labelRange.from} → {labelRange.to}
          {showTeamReport
            ? isManager
              ? " · Calls for you and your reportees"
              : null
            : ready
              ? " · Your call history from the mobile app"
              : null}
        </p>
      </div>

      <CallsFilterDrawer
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        applied={appliedFilters}
        onApply={setAppliedFilters}
      />

      {showTeamReport ? (
        <Tabs defaultValue="report">
          <TabsList>
            <TabsTrigger value="report">Call report</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="call-logs">Call Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="report" className="mt-4 space-y-4">
            <QuickFilterTabs
              tabs={USER_STATUS_TABS}
              value={userStatus}
              onChange={setUserStatus}
              variant="pill"
              ariaLabel="User status"
            />

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={userNameDraft}
                  onChange={(event) => setUserNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setUserNameSearch(userNameDraft.trim());
                    }
                  }}
                  placeholder="Search by User"
                  className="h-9 pl-9"
                  aria-label="Search by user name"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <Button variant="outline" onClick={() => setFilterDrawerOpen(true)}>
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                  {activeFilterCount > 0 ? (
                    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isExporting}
                  onClick={() => void handleExport()}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isExporting ? "Exporting..." : "Export (tabular)"}
                </Button>
                <div className="flex items-center gap-2">
                  <Label htmlFor="calls-page-size" className="text-sm text-muted-foreground">
                    Show Entries
                  </Label>
                  <select
                    id="calls-page-size"
                    className={selectClass}
                    value={userReportPageSize}
                    onChange={(event) =>
                      setUserReportPageSize(Number(event.target.value) as CallsReportPageSize)
                    }
                  >
                    {CALLS_REPORT_PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {userReport.isError && showTeamReport ? (
              <EmptyState
                title="Unable to load call report"
                description="The report could not be loaded. Check your connection and try again."
                actionLabel="Retry"
                onActionClick={() => void userReport.refetch()}
                icon={<AlertCircle className="h-7 w-7" />}
              />
            ) : (
              <CallsUserReportTable
                rows={showUserReport ? userReport.data.items : []}
                totals={
                  showUserReport
                    ? userReport.data.totals
                    : {
                        incomingAnswered: 0,
                        incomingMissed: 0,
                        incomingTotal: 0,
                        outgoingAnswered: 0,
                        outgoingNotConnected: 0,
                        outgoingTotal: 0,
                        totalTalkTimeSeconds: 0,
                        avgTalkTimeSeconds: 0,
                        minTalkTimeSeconds: 0,
                        maxTalkTimeSeconds: 0,
                        totalCalls: 0,
                        siteVisitsBooked: 0,
                        siteVisitsConducted: 0,
                      }
                }
                total={showUserReport ? userReport.data.total : 0}
                page={showUserReport ? userReport.data.page : userReportPage}
                pageSize={userReportPageSize}
                onPageChange={setUserReportPage}
                isLoading={userReport.isLoading}
              />
            )}
          </TabsContent>

          <TabsContent value="analytics" className="mt-4 space-y-6">
            {analyticsReport.isLoading ? (
              <p className="text-muted-foreground">Loading call analytics...</p>
            ) : analyticsReport.isError ? (
              <EmptyState
                title="Unable to load call analytics"
                description="Charts could not be loaded for the selected date range."
                actionLabel="Retry"
                onActionClick={() => void analyticsReport.refetch()}
                icon={<AlertCircle className="h-7 w-7" />}
              />
            ) : showAnalytics ? (
              <>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleExportAnalytics()}
                    disabled={isExportingAnalytics}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {isExportingAnalytics ? "Exporting..." : "Export (analytics)"}
                  </Button>
                </div>

                <LineAreaChart
                  title="Calls over time (click a point to drill down)"
                  points={analyticsReport.data.calls_over_time.map((row) => ({
                    label: row.date,
                    value: row.total_calls,
                  }))}
                  selectedLabel={selectedDate ?? undefined}
                  onPointClick={(label) => setSelectedDate(label)}
                />

                <div className="grid gap-6 lg:grid-cols-2">
                  <PieChart
                    title="Outcome breakdown"
                    items={analyticsReport.data.disposition_breakdown.map((row) => ({
                      label:
                        row.disposition in CALL_OUTCOME_LABELS
                          ? CALL_OUTCOME_LABELS[row.disposition as CallOutcome]
                          : row.disposition,
                      value: row.count,
                    }))}
                  />
                  <PieChart
                    title="Direction breakdown"
                    items={analyticsReport.data.direction_breakdown.map((row) => ({
                      label: row.direction,
                      value: row.count,
                    }))}
                  />
                </div>

                <BarChart
                  title="Direction breakdown (bar)"
                  items={analyticsReport.data.direction_breakdown.map((row) => ({
                    label: row.direction,
                    value: row.count,
                  }))}
                />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="call-logs" className="mt-4 space-y-4">
            <CallLogsReportPanel dateFrom={apiRange.dateFrom} dateTo={apiRange.dateTo} />
          </TabsContent>
        </Tabs>
      )}

      <div ref={detailsRef}>
        <Card className={selectedDate ? "ring-2 ring-primary" : undefined}>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base text-foreground">Call details</CardTitle>
              <p className="text-sm font-medium text-foreground/80">
                {selectedDate
                  ? `Showing calls on ${selectedDate}`
                  : `All calls in ${labelRange.from} → ${labelRange.to}`}
              </p>
            </div>
            {selectedDate ? (
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(null)}>
                Clear selection
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {callsList.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading calls...</p>
            ) : callsList.isError ? (
              isForbiddenError(callsList.error) ? (
                <AccessDeniedEmptyState />
              ) : (
                <p className="text-sm text-muted-foreground">Unable to load call list.</p>
              )
            ) : callsList.data ? (
              <CallsListTable calls={callsList.data.items} showLead showLeadId showPhone />
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load call list.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
