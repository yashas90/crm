"use client";

import { useSession } from "@/hooks/use-session";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowLeft, Bell, MapPin, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function formatIst(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
    hour12: true,
  }).format(new Date(iso));
}

type HealthRow = {
  userId: string;
  name: string;
  email: string;
  trackingPolicyEnabled: boolean;
  deviceId: string | null;
  platform: string | null;
  healthStatus: string | null;
  agentStatus: string | null;
  deviceStatus: string | null;
  locationPermissionStatus: string | null;
  callLogPermissionStatus: string | null;
  lastSeenAt: string | null;
  lastLocationAt: string | null;
  lastKnownCapturedAt: string | null;
  batteryLevel?: number | null;
};

function StaleBadge() {
  return (
    <span className="inline-flex items-center rounded border border-red-500/60 bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-800 dark:bg-red-950 dark:text-red-300">
      Stale
    </span>
  );
}

export default function TrackingHealthPage() {
  const { session, ready, isAdmin } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ready) return;
    if (!session || !isAdmin) router.replace("/");
  }, [ready, session, isAdmin, router]);

  const health = useQuery({
    queryKey: ["locations", "health"],
    queryFn: () =>
      apiGet<{
        agents: HealthRow[];
        config: { scheduleLabel: string; missingAlertMinutes?: number };
      }>("/api/locations/health"),
    enabled: ready && isAdmin,
    refetchInterval: 5 * 60 * 1000,
  });

  const toggle = useMutation({
    mutationFn: async ({ userId, enable }: { userId: string; enable: boolean }) => {
      await apiPost(`/api/locations/agents/${userId}/${enable ? "enable" : "disable"}`, {});
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["locations"] }),
  });

  if (!ready || !session || !isAdmin) return null;

  const agents = health.data?.agents ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/locations">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Live locations
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Tracking health</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Device communication, permissions, and last known location.{" "}
            {health.data?.config.scheduleLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/locations/alerts">
              <Bell className="mr-2 h-4 w-4" />
              Alerts
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/tracking">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Agents</CardTitle>
          <CardDescription>
            STALE is likely uninstall (24h+ no ping, no boot, no offline queue). Overnight silence
            is PAUSED — never stale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {health.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Agent</th>
                    <th className="px-2 py-2 font-medium">Device</th>
                    <th className="px-2 py-2 font-medium">Tracking</th>
                    <th className="px-2 py-2 font-medium">Last location</th>
                    <th className="px-2 py-2 font-medium">Last seen</th>
                    <th className="px-2 py-2 font-medium">Permission</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.userId} className="border-b border-border/60">
                      <td className="px-2 py-2">
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">{agent.email}</p>
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {agent.platform ?? "—"}
                        {agent.deviceId ? (
                          <span className="block font-mono text-[10px] text-muted-foreground">
                            {agent.deviceId.slice(0, 16)}…
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        {agent.trackingPolicyEnabled ? "Enabled" : "Disabled"}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {formatIst(agent.lastLocationAt ?? agent.lastKnownCapturedAt)}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">{formatIst(agent.lastSeenAt)}</td>
                      <td className="px-2 py-2 text-xs">
                        Loc: {agent.locationPermissionStatus ?? "—"}
                        <br />
                        Call: {agent.callLogPermissionStatus ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-xs font-medium">
                        <div className="flex flex-wrap items-center gap-1">
                          {(agent.agentStatus === "stale" || agent.healthStatus === "STALE") && (
                            <StaleBadge />
                          )}
                          <span>
                            {(agent.agentStatus ?? agent.healthStatus ?? "UNKNOWN")
                              .toString()
                              .replaceAll("_", " ")
                              .toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Button asChild variant="outline" size="sm">
                            <Link
                              href={`/locations/history?userId=${encodeURIComponent(agent.userId)}`}
                            >
                              <MapPin className="mr-1 h-3 w-3" />
                              History
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={toggle.isPending}
                            onClick={() =>
                              toggle.mutate({
                                userId: agent.userId,
                                enable: !agent.trackingPolicyEnabled,
                              })
                            }
                          >
                            {agent.trackingPolicyEnabled ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
