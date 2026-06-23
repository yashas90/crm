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
import { Flame, Phone, Users } from "lucide-react";
import Link from "next/link";
import { Suspense, useMemo } from "react";

function StatCard({
  label,
  value,
  loading,
  variant = "default",
}: {
  label: string;
  value: string | number;
  loading?: boolean;
  variant?: "default" | "hot";
}) {
  return (
    <NeuCard
      className={`flex aspect-square flex-col justify-between p-6 ${
        variant === "hot" ? "bg-[#C02020] text-white" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="font-heading text-lg font-bold uppercase">{label}</span>
        {variant === "hot" ? <Flame className="h-8 w-8" /> : null}
      </div>
      {loading ? (
        <Skeleton className="h-16 w-24 bg-black/10" />
      ) : (
        <div className="text-6xl font-bold tracking-tighter md:text-7xl">
          {String(value).padStart(2, "0")}
        </div>
      )}
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
    <div className="space-y-12">
      <header>
        <h1 className="font-heading text-4xl font-bold uppercase italic tracking-tighter md:text-6xl">
          My Dashboard
        </h1>
        <p className="mt-2 text-lg font-medium text-neutral-600">
          Real estate hustle, simplified. Track your leads and close deals.
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-12 lg:gap-12">
        <main className="space-y-12 lg:col-span-9">
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
              <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <StatCard
                  label="My Leads"
                  value={myLeads.data?.total ?? 0}
                  loading={myLeads.isLoading}
                />
                <StatCard
                  label="Hot Leads"
                  value={hotLeads.length}
                  loading={myLeads.isLoading}
                  variant="hot"
                />
                <StatCard label="Follow-ups Due" value={followUpsDue} loading={myLeads.isLoading} />
              </section>

              <MyTasksDueTodayWidget variant="neubrutal" />
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
            <NeuCard hover={false} className="flex items-center gap-3 bg-white px-4 py-2">
              <span className="h-3 w-3 animate-pulse rounded-full border border-black bg-green-500" />
              <span className="font-heading text-sm font-bold uppercase">Live activity</span>
            </NeuCard>
          </section>

          {hotLeads.length > 0 ? (
            <section className="space-y-4">
              <NeuSectionHeading title="Hot Leads Ledger" />
              <HotLeadsTable
                variant="neubrutal"
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
              <Skeleton className="h-40 w-full rounded-none border-2 border-black" />
            ) : recentActivities.isError ? (
              <EmptyState
                title="Couldn't load activity"
                description="Recent activity failed to load."
                actionLabel="Retry"
                onActionClick={() => void recentActivities.refetch()}
                className="py-8"
              />
            ) : (
              <RecentActivityFeed variant="neubrutal" activities={recentActivities.data ?? []} />
            )}
          </section>
        </main>

        <aside className="mt-12 hidden lg:col-span-3 lg:mt-0 lg:block">
          <RemindersPanel variant="neubrutal" />
        </aside>
      </div>

      <div className="lg:hidden">
        <RemindersPanel variant="neubrutal" collapsible />
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
        <Skeleton className="h-12 w-64 border-2 border-black" />
        <Skeleton className="h-4 w-72 border-2 border-black" />
        <Skeleton className="h-48 w-full border-2 border-black" />
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
