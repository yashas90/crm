"use client";

import { EmptyState } from "@/components/common/empty-state";
import { AdminDashboardView } from "@/components/dashboard/admin-dashboard-view";
import { OverviewSectionsSkeleton } from "@/components/dashboard/dashboard-skeletons";
import { HotLeadsTable } from "@/components/dashboard/hot-leads-table";
import { MyTasksDueTodayWidget } from "@/components/dashboard/my-tasks-due-today-widget";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { RemindersPanel } from "@/components/dashboard/reminders-panel";
import { NeuButton, NeuCard, NeuSectionHeading } from "@/components/ui/neubrutal";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeads } from "@/hooks/use-leads";
import { useRecentActivities } from "@/hooks/use-reports";
import { useSession } from "@/hooks/use-session";
import { cn } from "@propninja/ui/lib/utils";
import { CalendarClock, Flame, Phone, Users } from "lucide-react";
import Link from "next/link";
import { Suspense, useMemo } from "react";

const STAT_VARIANTS = {
  default: {
    iconBg: "bg-[#204060]/10 text-[#204060]",
    accent: "from-[#204060]/15 via-[#204060]/5 to-transparent",
    bar: "bg-[#204060]",
  },
  hot: {
    iconBg: "bg-rose-500/10 text-rose-600",
    accent: "from-rose-500/15 via-rose-500/5 to-transparent",
    bar: "bg-rose-500",
  },
  followup: {
    iconBg: "bg-amber-500/10 text-amber-600",
    accent: "from-amber-500/15 via-amber-500/5 to-transparent",
    bar: "bg-amber-500",
  },
};

function Sparkline({ bars, barClass }: { bars: number[]; barClass: string }) {
  return (
    <div className="flex h-8 items-end gap-0.5">
      {bars.map((h, i) => (
        <div
          key={`spark-${i}`}
          className={cn("w-1.5 rounded-sm opacity-60 transition-all", barClass)}
          style={{ height: `${Math.round(h * 100)}%` }}
        />
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  variant = "default",
  icon: Icon,
  animClass,
  sparkline,
}: {
  label: string;
  value: string | number;
  loading?: boolean;
  variant?: "default" | "hot" | "followup";
  icon: typeof Users;
  animClass?: string;
  sparkline?: number[];
}) {
  const styles = STAT_VARIANTS[variant];

  return (
    <NeuCard className={cn("overflow-hidden p-0", animClass)}>
      <div className={cn("h-1 w-full", styles.bar)} />
      <div className="relative p-5">
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60",
            styles.accent,
          )}
        />
        <div className="relative flex items-start gap-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              styles.iconBg,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            {loading ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <p className="mt-0.5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {typeof value === "number" ? value.toLocaleString() : value}
              </p>
            )}
          </div>
          {sparkline && !loading ? (
            <div className="shrink-0 self-end">
              <Sparkline bars={sparkline} barClass={styles.bar} />
            </div>
          ) : null}
        </div>
      </div>
    </NeuCard>
  );
}

function AgentDashboard() {
  const { session, ready } = useSession();
  const myLeads = useLeads(
    { page: "1", pageSize: "50", assignedTo: session?.id },
    { enabled: ready && Boolean(session?.id) },
  );
  const recentActivities = useRecentActivities();

  const hotLeads = useMemo(
    () => (myLeads.data?.items ?? []).filter((lead) => lead.temperature === "hot"),
    [myLeads.data],
  );

  const followUpsDue = useMemo(() => {
    const now = new Date();
    return (myLeads.data?.items ?? []).filter(
      (lead) => lead.nextFollowupAt && new Date(lead.nextFollowupAt) <= now,
    ).length;
  }, [myLeads.data]);

  return (
    <div className="space-y-8">
      <header className="animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl dark:text-white">
          My Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Track leads, follow-ups, and calls — all in one place.
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <main className="space-y-8 lg:col-span-9">
          {myLeads.isError ? (
            <EmptyState
              title="Couldn't load your leads"
              description="Your lead counts failed to load."
              actionLabel="Retry"
              onActionClick={() => void myLeads.refetch()}
              className="py-8"
            />
          ) : (
            <>
              <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard
                  label="My Leads"
                  value={myLeads.data?.total ?? 0}
                  loading={myLeads.isLoading}
                  icon={Users}
                  animClass="animate-fade-up-1"
                  sparkline={[0.4, 0.5, 0.45, 0.6, 0.55, 0.7, 0.8]}
                />
                <StatCard
                  label="Hot Leads"
                  value={hotLeads.length}
                  loading={myLeads.isLoading}
                  variant="hot"
                  icon={Flame}
                  animClass="animate-fade-up-2"
                  sparkline={[0.3, 0.5, 0.4, 0.65, 0.55, 0.75, 0.9]}
                />
                <StatCard
                  label="Follow-ups Due"
                  value={followUpsDue}
                  loading={myLeads.isLoading}
                  variant="followup"
                  icon={CalendarClock}
                  animClass="animate-fade-up-3"
                  sparkline={[0.7, 0.6, 0.8, 0.5, 0.65, 0.6, 0.55]}
                />
              </section>

              <MyTasksDueTodayWidget />
            </>
          )}

          <section className="flex flex-wrap items-center gap-4">
            <Link href="/leads">
              <NeuButton variant="primary">
                <Users className="h-5 w-5" />
                View my leads
              </NeuButton>
            </Link>
            <Link href="/reports/calls">
              <NeuButton>
                <Phone className="h-5 w-5" />
                My calls
              </NeuButton>
            </Link>
            <div className="flex-grow" />
            <NeuCard hover={false} className="flex items-center gap-2 px-4 py-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-slate-600">Live activity</span>
            </NeuCard>
          </section>

          {hotLeads.length > 0 ? (
            <section className="space-y-4">
              <NeuSectionHeading title="Hot Leads" />
              <HotLeadsTable
                leads={hotLeads.map((lead) => ({
                  id: lead.id,
                  name: `${lead.firstName} ${lead.lastName}`.trim(),
                  phone: lead.phone,
                  city: lead.city,
                  status: lead.leadStatus,
                  last_contacted_at: lead.lastContactedAt,
                  next_followup_at: lead.nextFollowupAt ?? null,
                }))}
              />
            </section>
          ) : null}

          <section>
            {recentActivities.isLoading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : recentActivities.isError ? (
              <EmptyState
                title="Couldn't load activity"
                description="Recent activity failed to load."
                actionLabel="Retry"
                onActionClick={() => void recentActivities.refetch()}
                className="py-8"
              />
            ) : (
              <RecentActivityFeed activities={recentActivities.data ?? []} />
            )}
          </section>
        </main>

        <aside className="mt-12 hidden lg:col-span-3 lg:mt-0 lg:block">
          <RemindersPanel />
        </aside>
      </div>

      <div className="lg:hidden">
        <RemindersPanel collapsible />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { session, ready } = useSession();
  const role = ready ? (session?.role ?? null) : null;
  const isAgent = role === "agent";

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isAgent) {
    return <AgentDashboard />;
  }

  return (
    <Suspense fallback={<OverviewSectionsSkeleton />}>
      <AdminDashboardView enabled={ready && !isAgent} />
    </Suspense>
  );
}
