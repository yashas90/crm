"use client";

import { useSession } from "@/hooks/use-session";
import { apiGet } from "@/lib/apiClient";
import type { AgentLocationPing } from "@propninja/types";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { useQuery } from "@tanstack/react-query";
import { MapPin, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

function minutesAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins <= 0) return "just now";
  if (mins === 1) return "1 minute ago";
  return `${mins} minutes ago`;
}

function buildStaticMapUrl(agents: AgentLocationPing[], apiKey: string): string {
  const markers = agents.map((a) => `markers=color:red%7C${a.latitude},${a.longitude}`).join("&");
  return `https://maps.googleapis.com/maps/api/staticmap?size=600x400&${markers}&key=${apiKey}`;
}

export default function LocationsPage() {
  const { session, ready, isAdmin, isManager } = useSession();
  const router = useRouter();
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  useEffect(() => {
    if (!ready) return;
    if (!session || (!isAdmin && !isManager)) {
      router.replace("/");
    }
  }, [ready, session, isAdmin, isManager, router]);

  const live = useQuery({
    queryKey: ["locations", "live"],
    queryFn: () => apiGet<{ agents: AgentLocationPing[] }>("/api/locations/live"),
    enabled: ready && (isAdmin || isManager),
    refetchInterval: 30_000,
  });

  const agents = live.data?.agents ?? [];
  const mapUrl = useMemo(() => {
    if (!mapsKey || agents.length === 0) return null;
    return buildStaticMapUrl(agents, mapsKey);
  }, [agents, mapsKey]);

  if (!ready || !session || (!isAdmin && !isManager)) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Agent Locations</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Live positions from the mobile app during work hours.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={live.isFetching}
          onClick={() => void live.refetch()}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${live.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {mapUrl ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Live map</CardTitle>
            <CardDescription>Pins for agents active in the last 15 minutes</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Static Maps API — no interactive JS map dependency */}
            <img
              src={mapUrl}
              alt="Agent locations map"
              className="h-auto w-full max-w-3xl rounded-lg border border-border"
            />
          </CardContent>
        </Card>
      ) : null}

      {live.isError ? (
        <p className="text-sm text-destructive">Could not load live locations. Try refresh.</p>
      ) : null}

      {agents.length === 0 && !live.isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No agents active in the last 15 minutes.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.userId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{agent.name}</CardTitle>
                <CardDescription>{agent.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">Last seen {minutesAgo(agent.capturedAt)}</p>
                <p className="font-mono text-xs">
                  {agent.latitude.toFixed(5)}, {agent.longitude.toFixed(5)}
                  {agent.accuracy != null ? ` · ±${Math.round(agent.accuracy)}m` : ""}
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/locations/history?userId=${encodeURIComponent(agent.userId)}`}>
                    View History
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Only agents active in the last 15 minutes are shown. Location is only collected Mon–Sat 9 AM
        – 7 PM IST.
      </p>
    </div>
  );
}
