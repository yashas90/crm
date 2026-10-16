"use client";

import { CallsListTable } from "@/components/calls/calls-list-table";
import { StatCard } from "@/components/reports/stat-card";
import { useCallSummary, useCalls } from "@/hooks/use-leads";
import { getIstDayBounds, getIstMonthBounds, getIstWeekBounds } from "@propninja/types/ist";
import { useMemo } from "react";

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

function rangeIso(start: Date, end: Date) {
  return { date_from: start.toISOString(), date_to: end.toISOString() };
}

type CallLogsReportPanelProps = {
  dateFrom: string;
  dateTo: string;
};

export function CallLogsReportPanel({ dateFrom, dateTo }: CallLogsReportPanelProps) {
  const todayRange = useMemo(() => {
    const { start, end } = getIstDayBounds(0);
    return rangeIso(start, end);
  }, []);

  const weekRange = useMemo(() => {
    const { start, end } = getIstWeekBounds();
    return rangeIso(start, end);
  }, []);

  const monthRange = useMemo(() => {
    const { start, end } = getIstMonthBounds();
    return rangeIso(start, end);
  }, []);

  const todaySummary = useCallSummary(todayRange);
  const weekSummary = useCallSummary(weekRange);
  const monthSummary = useCallSummary(monthRange);

  const rangeSummary = useCallSummary({ date_from: dateFrom, date_to: dateTo });

  const callsList = useCalls({
    date_from: dateFrom,
    date_to: dateTo,
    page: "1",
    pageSize: "100",
  });

  const callsPerLead = useMemo(() => {
    const items = callsList.data?.items ?? [];
    const leadIds = new Set(items.filter((call) => call.lead?.id).map((call) => call.lead!.id));
    return leadIds.size;
  }, [callsList.data?.items]);

  const totalDurationSeconds = rangeSummary.data?.total_talk_time_seconds ?? 0;
  const unansweredCount = rangeSummary.data?.missed_calls ?? 0;
  const answeredCount =
    rangeSummary.data?.answered_calls ?? rangeSummary.data?.completed_calls ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Calls today"
          value={todaySummary.data?.total_calls ?? 0}
          hint={`${todaySummary.data?.missed_calls ?? 0} not answered`}
        />
        <StatCard
          title="Calls this week"
          value={weekSummary.data?.total_calls ?? 0}
          hint={`Avg talk ${weekSummary.data?.average_duration ?? 0}s`}
        />
        <StatCard
          title="Calls this month"
          value={monthSummary.data?.total_calls ?? 0}
          hint={`${monthSummary.data?.answered_calls ?? monthSummary.data?.completed_calls ?? 0} answered`}
        />
        <StatCard
          title="Total talk time (range)"
          value={formatDuration(totalDurationSeconds)}
          hint={`${answeredCount} answered · ${callsPerLead} leads on this page`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="Unanswered in range" value={unansweredCount} />
        <StatCard
          title="Calls in range"
          value={rangeSummary.data?.total_calls ?? callsList.data?.total ?? 0}
          hint="Same answered and talk-time rules as the call report"
        />
      </div>

      {callsList.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading call logs…</p>
      ) : callsList.data ? (
        <CallsListTable calls={callsList.data.items} showLead showLeadId showPhone />
      ) : (
        <p className="text-sm text-muted-foreground">Unable to load call logs.</p>
      )}
    </div>
  );
}
