"use client";

import { useSession } from "@/hooks/use-session";
import { useUsers } from "@/hooks/use-users";
import { apiGet } from "@/lib/apiClient";
import type { AgentLocationPing } from "@propninja/types";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Phone, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

function minutesAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins <= 0) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours === 1 && rem === 0) return "1 hour ago";
  if (hours === 1) return `1 hour ${rem}m ago`;
  if (rem === 0) return `${hours} hours ago`;
  return `${hours}h ${rem}m ago`;
}

function buildStaticMapUrl(agents: AgentLocationPing[], apiKey: string): string {
  const markers = agents.map((a) => `markers=color:red%7C${a.latitude},${a.longitude}`).join("&");
  return `https://maps.googleapis.com/maps/api/staticmap?size=600x400&${markers}&key=${apiKey}`;
}

export default function LocationsPage() {
  const { session, ready, isAdmin } = useSession();
  const router = useRouter();
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  useEffect(() => {
    if (!ready) return;
    if (!session || !isAdmin) {
      router.replace("/");
    }
  }, [ready, session, isAdmin, router]);

  const live = useQuery({
    queryKey: ["locations", "live"],
    queryFn: () =>
      apiGet<{
        agents: AgentLocationPing[];
        config?: {
          scheduleLabel: string;
          retentionDays: number;
          withinHours: boolean;
          missingAlertMinutes: number;
        };
      }>("/api/locations/live"),
    enabled: ready && isAdmin,
    refetchInterval: 30_000,
  });

  const agentsList = useUsers("agent", { enabled: ready && isAdmin });
  const teamAgents = (agentsList.data ?? []).filter((u) => u.isActive);

  const agents = live.data?.agents ?? [];
  const liveIds = useMemo(() => new Set(agents.map((a) => a.userId)), [agents]);
  const mapUrl = useMemo(() => {
    if (!mapsKey || agents.length === 0) return null;
    return buildStaticMapUrl(agents, mapsKey);
  }, [agents, mapsKey]);

  if (!ready || !session || !isAdmin) {
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
            Live positions are pushed from agents&apos; phones (PropNinja app) — Refresh only
            reloads what the API already received. Tracking runs 9:30 AM–8:30 PM IST (Mon–Sun),
            about every 30 minutes, only with &quot;Allow all the time&quot; location. Agents show{" "}
            <span className="font-medium text-foreground">STALE</span> after{" "}
            {live.data?.config?.missingAlertMinutes ?? 45} minutes without a GPS ping. Records are
            kept 14 days. The CRM stays locked until agents grant required permissions.
            {live.data?.config?.withinHours === false ? (
              <span className="mt-1 block text-amber-600 dark:text-amber-400">
                Outside working hours — new pings are paused until the next window.
              </span>
            ) : null}
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
            <CardDescription>Pins for agents with a ping in the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
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
          <CardContent className="space-y-2 py-10 text-center text-sm text-muted-foreground">
            <p>No agent pings in the last 24 hours.</p>
            <p className="text-xs">
              Agents must install the app, tap Enable for location (Allow all the time) and call
              log, then keep the app installed so pings upload.
            </p>
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
                {agent.trackingStatus ? (
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status: {agent.trackingStatus.replaceAll("_", " ")}
                    {agent.locationPermissionStatus
                      ? ` · Location ${agent.locationPermissionStatus}`
                      : ""}
                    {agent.batteryLevel != null ? ` · Battery ${agent.batteryLevel}%` : ""}
                  </p>
                ) : null}
                <p className="font-mono text-xs">
                  {agent.latitude.toFixed(5)}, {agent.longitude.toFixed(5)}
                  {agent.accuracy != null ? ` · ±${Math.round(agent.accuracy)}m` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`https://www.google.com/maps?q=${agent.latitude},${agent.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin className="mr-1.5 h-3.5 w-3.5" />
                      Open map
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/locations/history?userId=${encodeURIComponent(agent.userId)}`}>
                      Travel & calls
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All agents</CardTitle>
          <CardDescription>
            Green &quot;Live&quot; means a GPS ping in the last 24 hours from the app. Agents
            without Live have not opened the app with location on (or never installed it). Travel
            history and call logs are still available when they do use the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teamAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active agents found.</p>
          ) : (
            <ul className="divide-y divide-border">
              {teamAgents.map((agent) => (
                <li
                  key={agent.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {agent.name}
                      {liveIds.has(agent.id) ? (
                        <span className="ml-2 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                          Live
                        </span>
                      ) : (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          Not tracked
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{agent.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/locations/history?userId=${encodeURIComponent(agent.id)}`}>
                        <MapPin className="mr-1.5 h-3.5 w-3.5" />
                        Travel
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/locations/history?userId=${encodeURIComponent(agent.id)}#calls`}
                      >
                        <Phone className="mr-1.5 h-3.5 w-3.5" />
                        Calls
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Live pins show the latest ping within 24 hours during the tracking window (9:30 AM–8:30 PM
        IST, Mon–Sun). GPS cannot be collected without the mobile app — phone location permission
        alone in Android Settings is not enough if PropNinja is not installed. After install, agents
        must choose Allow all the time, keep the app installed (do not force-stop), and stay signed
        in so pings upload about every 30 minutes during working hours.
      </p>
    </div>
  );
}
