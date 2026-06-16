"use client";

import { EmptyState } from "@/components/common/empty-state";
import { AdminDashboardView } from "@/components/dashboard/admin-dashboard-view";
import { OverviewSectionsSkeleton } from "@/components/dashboard/dashboard-skeletons";
import { HotLeadsTable } from "@/components/dashboard/hot-leads-table";
import { MyTasksDueTodayWidget } from "@/components/dashboard/my-tasks-due-today-widget";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { RemindersPanel } from "@/components/dashboard/reminders-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeads } from "@/hooks/use-leads";
import { useRecentActivities } from "@/hooks/use-reports";
import { useSession } from "@/hooks/use-session";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Phone, Users } from "lucide-react";
import Link from "next/link";
import { Suspense, useMemo } from "react";

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
    <div className="space-y-6">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">My dashboard</h2>
            <p className="text-muted-foreground">Your assigned leads and recent activity.</p>
          </div>

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
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-border/60 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      My leads
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {myLeads.isLoading ? (
                      <Skeleton className="h-9 w-16" />
                    ) : (
                      <p className="text-3xl font-bold">{myLeads.data?.total ?? "—"}</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-border/60 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Hot leads
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {myLeads.isLoading ? (
                      <Skeleton className="h-9 w-16" />
                    ) : (
                      <p className="text-3xl font-bold">{hotLeads.length}</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-border/60 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Follow-ups due
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {myLeads.isLoading ? (
                      <Skeleton className="h-9 w-16" />
                    ) : (
                      <p className="text-3xl font-bold">{followUpsDue}</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <MyTasksDueTodayWidget />
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/leads">
                <Users className="mr-2 h-4 w-4" />
                View my leads
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/reports/calls">
                <Phone className="mr-2 h-4 w-4" />
                My calls
              </Link>
            </Button>
          </div>

          {hotLeads.length > 0 ? (
            <section className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Hot leads</h3>
                <p className="text-sm text-muted-foreground">Leads that need attention soon.</p>
              </div>
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

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Recent activity</h3>
              <p className="text-sm text-muted-foreground">
                Latest notes, calls, and status changes.
              </p>
            </div>
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
        </div>

        <aside className="hidden lg:block">
          <RemindersPanel className="sticky top-24" />
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
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-24 w-full rounded-xl" />
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
