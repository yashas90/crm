"use client";

import { useSession } from "@/hooks/use-session";
import { ApiRequestError, apiGet, apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type SecurityAlert = {
  id: string;
  alertType: string;
  userName: string | null;
  userEmail: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
};

type FailedLoginGroup = {
  ip: string;
  attempts: number;
};

type ExportEvent = {
  id: string;
  userName: string | null;
  entityType: string;
  entityName: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
};

type ActiveSession = {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  lastSeen: string;
  device: string;
  ipAddress: string | null;
  userAgent: string | null;
  sessionActive: boolean;
};

type SecurityAlertsResponse = {
  items: SecurityAlert[];
  failedLoginsByIp: FailedLoginGroup[];
  exportEvents: ExportEvent[];
};

export default function SecuritySettingsPage() {
  const { ready, isAdmin } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (ready && !isAdmin) {
      router.replace("/settings");
    }
  }, [ready, isAdmin, router]);

  const security = useQuery({
    queryKey: ["admin", "security-alerts"],
    queryFn: () => apiGet<SecurityAlertsResponse>("/api/admin/security-alerts"),
    enabled: ready && isAdmin,
  });

  const sessions = useQuery({
    queryKey: ["admin", "active-sessions"],
    queryFn: () => apiGet<{ sessions: ActiveSession[] }>("/api/admin/active-sessions"),
    enabled: ready && isAdmin,
  });

  const resolveAlert = useMutation({
    mutationFn: (id: string) => apiPost(`/api/admin/security-alerts/${id}/resolve`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "security-alerts"] });
      toast.success("Alert resolved.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiRequestError ? error.message : "Failed to resolve alert.");
    },
  });

  const revokeSessions = useMutation({
    mutationFn: (userId: string) => apiPost(`/api/admin/users/${userId}/revoke-sessions`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "active-sessions"] });
      toast.success("All sessions revoked for user.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiRequestError ? error.message : "Failed to revoke sessions.");
    },
  });

  if (!ready || !isAdmin) {
    return <p className="text-sm text-muted-foreground">Loading security dashboard…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Security monitoring</h1>
          <p className="text-muted-foreground">
            Failed logins, exports, anomaly alerts, and active sessions.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings">Back to settings</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Failed login attempts (24h)</CardTitle>
          <CardDescription>Grouped by IP address from audit logs.</CardDescription>
        </CardHeader>
        <CardContent>
          {security.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (security.data?.failedLoginsByIp.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              No failed login attempts in the last 24 hours.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">IP address</th>
                    <th className="py-2 font-medium">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {security.data?.failedLoginsByIp.map((row) => (
                    <tr key={row.ip} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">{row.ip}</td>
                      <td className="py-2">{row.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bulk export events</CardTitle>
          <CardDescription>Recent CSV exports from reports and leads.</CardDescription>
        </CardHeader>
        <CardContent>
          {security.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (security.data?.exportEvents.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No export events recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {security.data?.exportEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                >
                  <p className="font-medium">
                    {event.userName ?? "Unknown user"} exported {event.entityType}
                    {event.entityName ? `: ${event.entityName}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                    {event.ip ? ` · ${event.ip}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security alerts</CardTitle>
          <CardDescription>Anomaly detection events requiring review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {security.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (security.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No unresolved security alerts.</p>
          ) : (
            security.data?.items.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm">
                  <p className="font-medium">{alert.alertType}</p>
                  <p className="text-muted-foreground">
                    {alert.userName ?? "System"} · {new Date(alert.createdAt).toLocaleString()}
                    {alert.ip ? ` · ${alert.ip}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resolveAlert.isPending}
                  onClick={() => resolveAlert.mutate(alert.id)}
                >
                  Resolve
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active sessions</CardTitle>
          <CardDescription>
            Latest sign-in per user (last 30 days). Revoke forces re-login on all devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (sessions.data?.sessions.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No recent sessions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">User</th>
                    <th className="py-2 pr-4 font-medium">Device</th>
                    <th className="py-2 pr-4 font-medium">Last seen</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.data?.sessions.map((session) => (
                    <tr key={session.userId} className="border-b border-border/50">
                      <td className="py-2 pr-4">
                        <div>{session.userName}</div>
                        <div className="text-xs text-muted-foreground">{session.userEmail}</div>
                      </td>
                      <td className="py-2 pr-4 capitalize">{session.device}</td>
                      <td className="py-2 pr-4">{new Date(session.lastSeen).toLocaleString()}</td>
                      <td className="py-2 pr-4">
                        {session.sessionActive ? (
                          <span className="text-emerald-600">Active</span>
                        ) : (
                          <span className="text-muted-foreground">Revoked</span>
                        )}
                      </td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={revokeSessions.isPending}
                          onClick={() => revokeSessions.mutate(session.userId)}
                        >
                          Revoke all sessions
                        </Button>
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
