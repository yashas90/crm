"use client";

import { useSession } from "@/hooks/use-session";
import { useUsers } from "@/hooks/use-users";
import { apiGet } from "@/lib/apiClient";
import type { AgentLocationPing, AgentTrackingDevice } from "@propninja/types";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Phone, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

type AgentUiStatus = "active" | "paused" | "stale" | "offline";

function resolveAgentStatus(agent: AgentLocationPing): AgentUiStatus {
  if (agent.trackingPolicyEnabled === false || agent.agentStatus === "offline") {
    return "offline";
  }
  if (agent.agentStatus === "stale" || agent.isStale) return "stale";
  if (agent.agentStatus === "paused" || agent.withinHours === false) return "paused";
  return "active";
}

function pinColor(status: AgentUiStatus): string {
  if (status === "active") return "green";
  if (status === "paused") return "yellow";
  if (status === "stale") return "red";
  return "gray";
}

function buildStaticMapUrl(agents: AgentLocationPing[], apiKey: string): string {
  const withCoords = agents.filter(
    (a) => a.latitude != null && a.longitude != null && !Number.isNaN(a.latitude),
  );
  if (withCoords.length === 0) return "";
  const markers = withCoords
    .map((a) => {
      const status = resolveAgentStatus(a);
      return `markers=color:${pinColor(status)}%7C${a.latitude},${a.longitude}`;
    })
    .join("&");
  return `https://maps.googleapis.com/maps/api/staticmap?size=600x400&${markers}&key=${apiKey}`;
}

function StaleBadge() {
  return (
    <span className="ml-2 inline-flex items-center rounded border border-red-500/60 bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-800 dark:bg-red-950 dark:text-red-300">
      Stale
    </span>
  );
}

function AgentStatusBadge({ status }: { status: AgentUiStatus }) {
  if (status === "stale") return <StaleBadge />;
  if (status === "active") {
    return (
      <span className="ml-2 inline-flex items-center rounded border border-emerald-500/50 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        Active
      </span>
    );
  }
  if (status === "paused") {
    return (
      <span className="ml-2 inline-flex items-center rounded border border-amber-400/60 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        Paused
      </span>
    );
  }
  return (
    <span className="ml-2 inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
      Offline
    </span>
  );
}

async function reverseGeocode(
  lat: number,
  lng: number,
  mapsKey: string | undefined,
): Promise<string | null> {
  try {
    if (mapsKey) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${mapsKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as { results?: Array<{ formatted_address?: string }> };
        const addr = data.results?.[0]?.formatted_address;
        if (addr) return addr;
      }
    }
    const nominatim = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { Accept: "application/json" } },
    );
    if (!nominatim.ok) return null;
    const data = (await nominatim.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}

function agentTrackLabel(
  agentId: string,
  agentsById: Map<string, AgentLocationPing>,
  devicesByUser: Map<string, AgentTrackingDevice>,
): {
  text: string;
  tone: "live" | "stale" | "paused" | "device" | "none";
  status: AgentUiStatus;
} {
  const live = agentsById.get(agentId);
  if (live) {
    const status = resolveAgentStatus(live);
    if (status === "stale") return { text: "STALE (likely uninstalled)", tone: "stale", status };
    if (status === "offline") return { text: "Offline", tone: "none", status };
    if (status === "paused") return { text: "Paused (outside hours)", tone: "paused", status };
    return { text: live.isLastKnown ? "Active · last known" : "Live", tone: "live", status };
  }
  const device = devicesByUser.get(agentId);
  if (!device) return { text: "Not tracked", tone: "none", status: "offline" };
  const version = device.appVersion ? ` · app ${device.appVersion}` : "";
  if (device.locationPermissionStatus && device.locationPermissionStatus !== "granted") {
    return {
      text: `App seen · location denied${version}`,
      tone: "device",
      status: "active",
    };
  }
  return {
    text: `App seen ${minutesAgo(device.lastSeenAt)}${version}`,
    tone: "device",
    status: "active",
  };
}

export default function LocationsPage() {
  const { session, ready, isAdmin } = useSession();
  const router = useRouter();
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const [showOnlyStale, setShowOnlyStale] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (!session || !isAdmin) {
      router.replace("/");
    }
  }, [ready, session, isAdmin, router]);

  // Rule 1 — re-evaluate STALE every 5 minutes in the UI (also refetch).
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const live = useQuery({
    queryKey: ["locations", "live", tick],
    queryFn: () =>
      apiGet<{
        agents: AgentLocationPing[];
        devices?: AgentTrackingDevice[];
        config?: {
          scheduleLabel: string;
          retentionDays: number;
          withinHours: boolean;
          missingAlertMinutes: number;
        };
      }>("/api/locations/live"),
    enabled: ready && isAdmin,
    refetchInterval: 5 * 60 * 1000,
  });

  const agentsList = useUsers("agent", { enabled: ready && isAdmin });
  const teamAgents = (agentsList.data ?? []).filter((u) => u.isActive);

  const missingAlertMinutes = live.data?.config?.missingAlertMinutes ?? 45;
  const agents = live.data?.agents ?? [];
  const devices = live.data?.devices ?? [];

  const filteredAgents = useMemo(() => {
    if (!showOnlyStale) return agents;
    return agents.filter((a) => resolveAgentStatus(a) === "stale");
  }, [agents, showOnlyStale]);

  const agentsById = useMemo(() => {
    const map = new Map<string, AgentLocationPing>();
    for (const agent of agents) map.set(agent.userId, agent);
    return map;
  }, [agents]);
  const devicesByUser = useMemo(() => {
    const map = new Map<string, AgentTrackingDevice>();
    for (const device of devices) {
      map.set(device.userId, device);
    }
    return map;
  }, [devices]);
  const mapUrl = useMemo(() => {
    if (!mapsKey || filteredAgents.length === 0) return null;
    const url = buildStaticMapUrl(filteredAgents, mapsKey);
    return url || null;
  }, [filteredAgents, mapsKey]);

  const selected = selectedId
    ? (filteredAgents.find((a) => a.userId === selectedId) ??
      agents.find((a) => a.userId === selectedId) ??
      null)
    : null;

  useEffect(() => {
    if (!selected || selected.latitude == null || selected.longitude == null) return;
    if (addresses[selected.userId]) return;
    let cancelled = false;
    void reverseGeocode(selected.latitude, selected.longitude, mapsKey).then((addr) => {
      if (cancelled || !addr) return;
      setAddresses((prev) => ({ ...prev, [selected.userId]: addr }));
    });
    return () => {
      cancelled = true;
    };
  }, [selected, mapsKey, addresses]);

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
            Live positions from agents&apos; phones. Tracking runs 9:30 AM–8:30 PM IST every ~30
            minutes with Allow all the time location.{" "}
            <span className="font-medium text-foreground">STALE</span> means likely uninstalled (no
            ping for 24+ hours, no boot or queued offline pings). Phone off, no internet,
            force-stop, and overnight hours are not stale. Pins:{" "}
            <span className="text-emerald-600">green = active</span>,{" "}
            <span className="text-amber-600">yellow = paused (outside hours)</span>,{" "}
            <span className="text-red-600">red = stale / uninstalled</span>,{" "}
            <span className="text-muted-foreground">grey = offline</span>.
            {live.data?.config?.withinHours === false ? (
              <span className="mt-1 block text-amber-600 dark:text-amber-400">
                Outside working hours — new pings are paused until the next window.
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={showOnlyStale ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOnlyStale((v) => !v)}
          >
            {showOnlyStale ? "Showing stale only" : "Show Only Stale Agents"}
          </Button>
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
          <Button asChild variant="outline" size="sm">
            <Link href="/locations/health">Tracking health</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/locations/alerts">Alerts</Link>
          </Button>
        </div>
      </div>

      {mapUrl ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Live map</CardTitle>
            <CardDescription>
              Click an agent card below for last seen, address, and battery
            </CardDescription>
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

      {selected ? (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center text-base">
              {selected.name}
              <AgentStatusBadge status={resolveAgentStatus(selected)} />
            </CardTitle>
            <CardDescription>{selected.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Last seen: {selected.capturedAt ? minutesAgo(selected.capturedAt) : "No GPS ping yet"}
            </p>
            <p>
              Address:{" "}
              {addresses[selected.userId] ??
                (selected.latitude != null
                  ? `${selected.latitude.toFixed(5)}, ${selected.longitude?.toFixed(5)} (resolving…)`
                  : "—")}
            </p>
            <p>
              Battery:{" "}
              {selected.batteryLevel != null ? `${selected.batteryLevel}%` : "Not reported"}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {live.isError ? (
        <p className="text-sm text-destructive">Could not load live locations. Try refresh.</p>
      ) : null}

      {filteredAgents.length === 0 && !live.isLoading ? (
        <Card>
          <CardContent className="space-y-2 py-10 text-center text-sm text-muted-foreground">
            <p>
              {showOnlyStale
                ? "No stale agents right now."
                : "No agent GPS pings in the last 24 hours."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredAgents.map((agent) => {
            const status = resolveAgentStatus(agent);
            return (
              <Card
                key={agent.userId}
                className={
                  selectedId === agent.userId
                    ? "cursor-pointer ring-2 ring-primary"
                    : "cursor-pointer"
                }
                onClick={() => setSelectedId(agent.userId)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-wrap items-center text-base">
                    {agent.name}
                    <AgentStatusBadge status={status} />
                  </CardTitle>
                  <CardDescription>{agent.email}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {agent.isLastKnown || status === "paused" || status === "stale"
                      ? "Last known location"
                      : "Current location"}
                  </p>
                  <p className="text-muted-foreground">
                    {agent.capturedAt
                      ? `Last seen ${minutesAgo(agent.capturedAt)}`
                      : "No location yet"}
                  </p>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status: {status.toUpperCase()}
                    {agent.batteryLevel != null ? ` · Battery ${agent.batteryLevel}%` : ""}
                  </p>
                  {agent.lastSeenAt ? (
                    <p className="text-xs text-muted-foreground">
                      Last communication {minutesAgo(agent.lastSeenAt)}
                    </p>
                  ) : null}
                  <p className="font-mono text-xs">
                    {agent.latitude != null && agent.longitude != null
                      ? `${agent.latitude.toFixed(5)}, ${agent.longitude.toFixed(5)}`
                      : "—"}
                    {agent.accuracy != null ? ` · ±${Math.round(agent.accuracy)}m` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {agent.latitude != null && agent.longitude != null ? (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`https://www.google.com/maps?q=${agent.latitude},${agent.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MapPin className="mr-1.5 h-3.5 w-3.5" />
                          Open map
                        </a>
                      </Button>
                    ) : null}
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/locations/history?userId=${encodeURIComponent(agent.userId)}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Travel & calls
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All agents</CardTitle>
          <CardDescription>
            Green Live = GPS within {missingAlertMinutes} min during hours. Yellow Paused =
            overnight (20:30–09:30 IST). Red STALE = likely uninstalled (24h+ no ping). Grey =
            tracking disabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teamAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active agents found.</p>
          ) : (
            <ul className="divide-y divide-border">
              {teamAgents.map((agent) => {
                const label = agentTrackLabel(agent.id, agentsById, devicesByUser);
                if (showOnlyStale && label.status !== "stale") return null;
                return (
                  <li
                    key={agent.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {agent.name}
                        <AgentStatusBadge status={label.status} />
                        <span
                          className={
                            label.tone === "live"
                              ? "ml-2 text-xs font-normal text-emerald-600 dark:text-emerald-400"
                              : label.tone === "stale"
                                ? "ml-2 text-xs font-normal text-red-600 dark:text-red-400"
                                : label.tone === "paused" || label.tone === "device"
                                  ? "ml-2 text-xs font-normal text-amber-600 dark:text-amber-400"
                                  : "ml-2 text-xs font-normal text-muted-foreground"
                          }
                        >
                          {label.text}
                        </span>
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
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
