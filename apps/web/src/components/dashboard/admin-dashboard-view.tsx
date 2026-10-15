"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type AdminDashboardPeriod,
  type AdminOverview,
  type RevenueCard,
  useAdminOverview,
} from "@/hooks/use-admin-overview";
import { useSession } from "@/hooks/use-session";
import { getSession } from "@/lib/auth";
import { isForbiddenError } from "@/lib/query-errors";
import { formatDateTimeIst } from "@propninja/types/ist";
import { formatINR } from "@propninja/types/money";
import { cn } from "@propninja/ui/lib/utils";
import { Bell, CalendarClock, Trophy, Users } from "lucide-react";
import { type ReactNode, useState } from "react";

const PERIOD_OPTIONS: { value: AdminDashboardPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "quarter", label: "This quarter" },
];

type DraftFilters = { period: AdminDashboardPeriod; source: string };

const DEFAULT_FILTERS: DraftFilters = { period: "today", source: "" };

function firstNameOf(name: string | undefined) {
  const token = name?.trim().split(/\s+/)[0];
  return token || "there";
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
}

function Change({ value, inverted = false }: { value: number; inverted?: boolean }) {
  const up = value > 0;
  const down = value < 0;
  return (
    <span
      className={cn(
        "text-xs font-medium tabular-nums",
        inverted
          ? "text-white/90"
          : up
            ? "text-emerald-600"
            : down
              ? "text-rose-600"
              : "text-slate-400",
      )}
    >
      {up ? "↑" : down ? "↓" : ""}
      {Math.abs(value)}%
    </span>
  );
}

function Sparkline({ values, tone }: { values: number[]; tone: "light" | "dark" }) {
  const width = 92;
  const height = 32;
  const max = Math.max(...values, 1);
  const step = values.length <= 1 ? width : width / (values.length - 1);
  const coords = values.map((value, index) => {
    const x = index * step;
    const y = height - 3 - (value / max) * (height - 8);
    return [x, y] as const;
  });
  const line = coords
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const stroke = tone === "light" ? "rgba(255,255,255,0.95)" : "#64748b";
  const fill = tone === "light" ? "rgba(255,255,255,0.28)" : "rgba(100,116,139,0.18)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-8 w-[5.5rem]"
      role="img"
      aria-label="Revenue trend"
    >
      <title>Revenue trend</title>
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function RevenueTile({
  label,
  card,
  prominent = false,
}: {
  label: string;
  card: RevenueCard;
  prominent?: boolean;
}) {
  return (
    <article
      className={cn(
        "flex min-h-[8.5rem] flex-col justify-between rounded-xl border p-4 shadow-sm",
        prominent
          ? "border-emerald-700/20 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white sm:col-span-2 xl:col-span-1 xl:row-span-2"
          : "border-slate-200/80 bg-white dark:border-white/10 dark:bg-slate-900",
      )}
    >
      <p
        className={cn(
          "text-xs font-medium",
          prominent ? "text-emerald-50" : "text-slate-500 dark:text-slate-400",
        )}
      >
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p
            className={cn(
              "text-2xl font-semibold tracking-tight tabular-nums",
              prominent ? "text-white" : "text-slate-900 dark:text-white",
            )}
          >
            {formatINR(card.amount)}
          </p>
          <div className="mt-1">
            <Change value={card.changePercent} inverted={prominent} />
          </div>
        </div>
        <Sparkline values={card.sparkline} tone={prominent ? "light" : "dark"} />
      </div>
    </article>
  );
}

function LeadDonut({ active, lost, total }: { active: number; lost: number; total: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const activeLength = total === 0 ? 0 : (active / total) * circumference;
  const lostLength = total === 0 ? 0 : (lost / total) * circumference;

  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg
        viewBox="0 0 120 120"
        className="h-full w-full -rotate-90"
        role="img"
        aria-label="Total leads received"
      >
        <title>Total leads received</title>
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-slate-100 dark:text-slate-800"
        />
        {activeLength > 0 ? (
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="12"
            strokeDasharray={`${activeLength} ${circumference - activeLength}`}
          />
        ) : null}
        {lostLength > 0 ? (
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#fb7185"
            strokeWidth="12"
            strokeDasharray={`${lostLength} ${circumference - lostLength}`}
            strokeDashoffset={-activeLength}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold leading-none tabular-nums text-slate-900 dark:text-white">
          {total}
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          Leads
        </span>
      </div>
    </div>
  );
}

function FunnelGraphic({ stages }: { stages: AdminOverview["funnel"] }) {
  const width = 1000;
  const height = 84;
  const mid = height / 2;
  const segment = width / Math.max(stages.length, 1);
  const base = Math.max(stages[0]?.count ?? 0, 1);
  const half = (count: number) => (count <= 0 ? 3 : Math.max(10, (count / base) * (mid - 6)));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-20 w-full"
      role="img"
      aria-label="Lead funnel"
    >
      <title>Lead funnel</title>
      {stages.map((stage, index) => {
        const left = half(stage.count);
        const next = stages[index + 1];
        const right = next ? half(next.count) : Math.max(3, left * 0.7);
        const x0 = index * segment;
        const x1 = x0 + segment - 6;
        const points = `${x0},${mid - left} ${x1},${mid - right} ${x1},${mid + right} ${x0},${mid + left}`;
        return (
          <polygon key={stage.key} points={points} fill={index === 0 ? "#14b8a6" : "#7dd3fc"} />
        );
      })}
    </svg>
  );
}

function CardEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/10">
        <Bell className="h-4 w-4" />
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Users;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-[16rem] flex-col rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/10">
        <Icon className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      </header>
      <div className="flex-1 px-4 py-2">{children}</div>
    </section>
  );
}

function selectClassName() {
  return "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-100";
}

export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="grid gap-3 xl:grid-cols-5">
        <Skeleton className="h-56 xl:col-span-3" />
        <Skeleton className="h-56 xl:col-span-2" />
      </div>
      <Skeleton className="h-44 w-full" />
      <div className="grid gap-3 lg:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function DashboardBody({ data, updating }: { data: AdminOverview; updating: boolean }) {
  const received = data.leadsReceived;

  return (
    <>
      <section className="grid gap-3 xl:grid-cols-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:col-span-3 xl:grid-cols-3">
          <RevenueTile label="Total Revenue" card={data.revenue.total} prominent />
          <RevenueTile label="Revenue for Today" card={data.revenue.today} />
          <RevenueTile label="Revenue for Last 7 days" card={data.revenue.last7Days} />
          <RevenueTile label="Revenue for Last 30 days" card={data.revenue.last30Days} />
          <RevenueTile label="Revenue for Last Quarter" card={data.revenue.lastQuarter} />
        </div>

        <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900 xl:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <LeadDonut active={received.active} lost={received.lost} total={received.total} />
              <div>
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Total leads received
                </h2>
                <p className="mt-1 text-xs text-slate-500">{data.label}</p>
                <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    Active {received.active}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    Lost / junk {received.lost}
                  </li>
                </ul>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Top 5 sources that received new leads
              </h3>
              {data.sources.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No leads in this period</p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {data.sources.map((source) => (
                    <li key={source.source}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-slate-700 dark:text-slate-200">
                          {source.source}
                        </span>
                        <span className="tabular-nums text-slate-500">{source.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{ width: `${source.percent}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Lead Funnel</h2>
          <p className="text-xs text-slate-500">Live pipeline · percent of all leads</p>
        </div>
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.max(data.funnel.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {data.funnel.map((stage) => (
            <div key={stage.key} className="text-center">
              <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {stage.count}
              </p>
              <p className="text-xs text-slate-500">{stage.label}</p>
            </div>
          ))}
        </div>
        <FunnelGraphic stages={data.funnel} />
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${Math.max(data.funnel.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {data.funnel.map((stage) => (
            <p key={`${stage.key}-pct`} className="text-center text-xs font-medium text-slate-500">
              {stage.percent}%
            </p>
          ))}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <Panel title="Top Closers & Key Contributors" icon={Trophy}>
          {data.topClosers.length === 0 ? (
            <CardEmpty title="No data found" detail="No top closers & key contributors found" />
          ) : (
            <ul>
              {data.topClosers.map((closer) => (
                <li
                  key={closer.userId}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0 dark:border-white/10"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {closer.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {closer.deals} {closer.deals === 1 ? "deal" : "deals"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                    {formatINR(closer.netRevenue)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="New Lead Drivers" icon={Users}>
          <DriverRow label="New leads" stat={data.drivers.newLeads} />
          <DriverRow label="Site visits" stat={data.drivers.siteVisits} />
          <DriverRow label="Closed" stat={data.drivers.closed} />
          <DriverRow label="Pending" stat={data.drivers.pending} />
        </Panel>

        <Panel title="Reminders" icon={CalendarClock}>
          {data.reminders.length === 0 ? (
            <CardEmpty title="No data found" detail="No upcoming events found" />
          ) : (
            <ul>
              {data.reminders.map((reminder) => (
                <li
                  key={reminder.id}
                  className="flex items-start justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0 dark:border-white/10"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {reminder.title}
                    </p>
                    <p className="text-xs text-slate-500">{reminder.subtitle}</p>
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">
                    {formatDateTimeIst(reminder.at, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/10">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Agent Talktime
          </h2>
          <p className="text-xs text-slate-500">
            {data.label}
            {updating ? " · Updating…" : ""}
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[72rem] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 dark:bg-white/5">
              <tr>
                {[
                  "Agent name",
                  "Total calls",
                  "Connected",
                  "Total duration",
                  "Incoming",
                  "Incoming answered",
                  "Incoming missed",
                  "Incoming duration",
                  "Outgoing",
                  "Outgoing duration",
                  "Outgoing answered",
                  "Outgoing not answered",
                ].map((heading) => (
                  <th key={heading} className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.agentTalktime.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-sm text-slate-500">
                    No calls in this period
                  </td>
                </tr>
              ) : (
                data.agentTalktime.map((row) => (
                  <tr key={row.userId} className="border-t border-slate-100 dark:border-white/10">
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                      {row.name}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{row.totalCalls}</td>
                    <td className="px-3 py-2.5 tabular-nums">{row.connected}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                      {formatDuration(row.totalDurationSeconds)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{row.incoming}</td>
                    <td className="px-3 py-2.5 tabular-nums">{row.incomingAnswered}</td>
                    <td className="px-3 py-2.5 tabular-nums">{row.incomingMissed}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                      {formatDuration(row.incomingDurationSeconds)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{row.outgoing}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                      {formatDuration(row.outgoingDurationSeconds)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{row.outgoingAnswered}</td>
                    <td className="px-3 py-2.5 tabular-nums">{row.outgoingNotAnswered}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function DriverRow({
  label,
  stat,
}: {
  label: string;
  stat: { count: number; changePercent: number };
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0 dark:border-white/10">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className="flex items-center gap-3">
        <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
          {stat.count}
        </span>
        <Change value={stat.changePercent} />
      </span>
    </div>
  );
}

type AdminDashboardViewProps = {
  enabled: boolean;
};

export function AdminDashboardView({ enabled }: AdminDashboardViewProps) {
  const { session } = useSession();
  const [draft, setDraft] = useState<DraftFilters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<DraftFilters>(DEFAULT_FILTERS);
  const overview = useAdminOverview(applied.period, applied.source, enabled);
  const firstName = firstNameOf(session?.name ?? getSession()?.name);
  const data = overview.data;

  if (overview.isError && isForbiddenError(overview.error)) {
    return (
      <AccessDeniedEmptyState description="This dashboard is limited to admins and managers." />
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Welcome back, {firstName}!
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your real time sales performance at a glance
            {data?.scope === "team" ? " · team" : ""}
            {overview.isFetching && data ? " · Updating…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={selectClassName()}
            value={draft.period}
            aria-label="Period"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                period: event.target.value as AdminDashboardPeriod,
              }))
            }
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className={selectClassName()}
            value={draft.source}
            aria-label="Lead source"
            onChange={(event) =>
              setDraft((current) => ({ ...current, source: event.target.value }))
            }
          >
            <option value="">All sources</option>
            {(data?.sourceOptions ?? [])
              .concat(
                draft.source && !data?.sourceOptions?.includes(draft.source) ? [draft.source] : [],
              )
              .map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
          </select>
          <button
            type="button"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
            onClick={() => {
              setDraft(DEFAULT_FILTERS);
              setApplied(DEFAULT_FILTERS);
            }}
          >
            Reset
          </button>
          <button
            type="button"
            className="h-9 rounded-lg bg-[#204060] px-3 text-sm font-medium text-white shadow-sm hover:bg-[#18344f]"
            onClick={() => {
              if (draft.period === applied.period && draft.source === applied.source) {
                void overview.refetch();
                return;
              }
              setApplied(draft);
            }}
          >
            Apply
          </button>
        </div>
      </header>

      {overview.isLoading && !data ? <AdminDashboardSkeleton /> : null}

      {overview.isError && !isForbiddenError(overview.error) ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center dark:border-white/10 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            Couldn't load the dashboard
          </p>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-[#204060] underline"
            onClick={() => void overview.refetch()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {data ? <DashboardBody data={data} updating={overview.isFetching} /> : null}
    </div>
  );
}
