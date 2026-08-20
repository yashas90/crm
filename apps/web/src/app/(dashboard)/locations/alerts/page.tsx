"use client";

import { useSession } from "@/hooks/use-session";
import { apiGet } from "@/lib/apiClient";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type AlertRow = {
  id: string;
  agentId: string;
  agentName: string;
  agentEmail: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  createdAt: string;
};

export default function TrackingAlertsPage() {
  const { session, ready, isAdmin } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!session || !isAdmin) router.replace("/");
  }, [ready, session, isAdmin, router]);

  const alerts = useQuery({
    queryKey: ["locations", "alerts"],
    queryFn: () => apiGet<{ alerts: AlertRow[] }>("/api/locations/alerts"),
    enabled: ready && isAdmin,
    refetchInterval: 60_000,
  });

  if (!ready || !session || !isAdmin) return null;

  const items = alerts.data?.alerts ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/locations/health">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tracking health
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Tracking alerts</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Open alerts for permissions, offline devices, missing locations, and possible app removal.
          Admins also receive CRM notifications.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Open alerts</CardTitle>
          <CardDescription>
            Deduped while unresolved — one open alert per type per agent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open tracking alerts.</p>
          ) : (
            items.map((alert) => (
              <div key={alert.id} className="rounded-lg border border-border px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {alert.title}{" "}
                    <span className="text-xs font-normal uppercase text-muted-foreground">
                      {alert.severity}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(alert.createdAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </p>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {alert.agentName} · {alert.message}
                </p>
                <Button asChild variant="link" size="sm" className="mt-1 h-auto px-0">
                  <Link href={`/locations/history?userId=${encodeURIComponent(alert.agentId)}`}>
                    View agent travel
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
