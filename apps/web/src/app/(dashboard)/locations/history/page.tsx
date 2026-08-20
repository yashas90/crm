"use client";

import type { CallRecord } from "@/hooks/use-leads";
import { useCalls } from "@/hooks/use-leads";
import { useSession } from "@/hooks/use-session";
import { apiGet } from "@/lib/apiClient";
import type { LocationHistoryItem } from "@propninja/types";
import { getIstDateKey, istWallClockToDate } from "@propninja/types/ist";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

function formatIstTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function googleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function buildPathMapUrl(items: LocationHistoryItem[], apiKey: string): string | null {
  if (items.length === 0) return null;
  const path = items.map((i) => `${i.latitude},${i.longitude}`).join("|");
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const markers = [
    `markers=color:green%7Clabel:S%7C${first.latitude},${first.longitude}`,
    `markers=color:red%7Clabel:E%7C${last.latitude},${last.longitude}`,
  ].join("&");
  const pathParam = items.length > 1 ? `&path=color:0x204060ff%7Cweight:3%7C${path}` : "";
  return `https://maps.googleapis.com/maps/api/staticmap?size=640x360&${markers}${pathParam}&key=${apiKey}`;
}

function callWhoLabel(call: CallRecord): string {
  if (call.lead) {
    const name = `${call.lead.firstName} ${call.lead.lastName}`.trim();
    return name || call.phoneNumber;
  }
  return call.phoneNumber;
}

function LocationHistoryContent() {
  const { session, ready, isAdmin } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") ?? "";
  const [date, setDate] = useState(() => getIstDateKey());
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  useEffect(() => {
    if (!ready) return;
    if (!session || !isAdmin) {
      router.replace("/");
    }
  }, [ready, session, isAdmin, router]);

  const dayBounds = useMemo(() => {
    const start = istWallClockToDate(date, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [date]);

  const userQuery = useQuery({
    queryKey: ["users", userId],
    queryFn: () => apiGet<{ id: string; name: string; email: string }>(`/api/users/${userId}`),
    enabled: ready && isAdmin && Boolean(userId),
  });

  const history = useQuery({
    queryKey: ["locations", "history", userId, date],
    queryFn: () =>
      apiGet<{
        items: LocationHistoryItem[];
        total: number;
        gaps?: Array<{ from: string; to: string; minutes: number }>;
      }>(
        `/api/locations/history?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`,
      ),
    enabled: ready && isAdmin && Boolean(userId),
  });

  const osCallLogs = useQuery({
    queryKey: ["locations", "call-logs", userId, date],
    queryFn: () =>
      apiGet<{
        items: Array<{
          id: string;
          callType: string;
          phoneNumber: string | null;
          callStartTime: string;
          callEndTime: string | null;
          durationSeconds: number | null;
        }>;
        total: number;
      }>(
        `/api/locations/call-logs?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`,
      ),
    enabled: ready && isAdmin && Boolean(userId),
  });

  const calls = useCalls({
    user_id: userId || undefined,
    date_from: dayBounds.from,
    date_to: dayBounds.to,
    page: "1",
    pageSize: "100",
  });

  if (!ready || !session || !isAdmin) {
    return null;
  }

  if (!userId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Missing userId. Pick an agent from the live map.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/locations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Live Map
          </Link>
        </Button>
      </div>
    );
  }

  const items = history.data?.items ?? [];
  const gaps = history.data?.gaps ?? [];
  const total = history.data?.total ?? items.length;
  const agentName = userQuery.data?.name ?? "Agent";
  const pathMapUrl = mapsKey ? buildPathMapUrl(items, mapsKey) : null;
  const callItems = calls.data?.items ?? [];
  const osCallItems = osCallLogs.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/locations">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Live Map
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">{agentName} — travel & calls</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {userQuery.data?.email ?? userId} · {total} location ping{total === 1 ? "" : "s"} ·{" "}
            {callItems.length} call{callItems.length === 1 ? "" : "s"} on {date}
          </p>
        </div>
        <div className="space-y-1">
          <label
            htmlFor="location-history-date"
            className="text-xs font-medium text-muted-foreground"
          >
            Date (IST)
          </label>
          <Input
            id="location-history-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {pathMapUrl ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Travel path</CardTitle>
            <CardDescription>Green = start, red = end for {date} (IST)</CardDescription>
          </CardHeader>
          <CardContent>
            <img
              src={pathMapUrl}
              alt={`${agentName} travel path`}
              className="h-auto w-full max-w-3xl rounded-lg border border-border"
            />
          </CardContent>
        </Card>
      ) : null}

      {gaps.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Missing location intervals</CardTitle>
            <CardDescription>
              Gaps longer than ~1.75× the 30-minute schedule (possible offline, permission, or OS
              delay)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {gaps.map((gap) => (
                <li key={`${gap.from}-${gap.to}`} className="text-muted-foreground">
                  {formatIstTime(gap.from)} → {formatIstTime(gap.to)} · {gap.minutes} minutes
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Location pings</CardTitle>
          <CardDescription>Ordered by time (IST) — where they traveled</CardDescription>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : history.isError ? (
            <p className="py-6 text-center text-sm text-destructive">Could not load history.</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No pings for this day.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Time (IST)</th>
                    <th className="px-2 py-2 font-medium">Latitude</th>
                    <th className="px-2 py-2 font-medium">Longitude</th>
                    <th className="px-2 py-2 font-medium">Accuracy (m)</th>
                    <th className="px-2 py-2 font-medium">Map</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-border/60">
                      <td className="px-2 py-2 whitespace-nowrap">
                        {formatIstTime(item.capturedAt)}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{item.latitude.toFixed(6)}</td>
                      <td className="px-2 py-2 font-mono text-xs">{item.longitude.toFixed(6)}</td>
                      <td className="px-2 py-2">
                        {item.accuracy == null ? "—" : Math.round(item.accuracy)}
                      </td>
                      <td className="px-2 py-2">
                        <a
                          href={googleMapsUrl(item.latitude, item.longitude)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          title="Open in Google Maps"
                          aria-label={`Open map at ${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`}
                        >
                          <MapPin className="h-4 w-4" />
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="os-calls">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-4 w-4" />
            Device call metadata
          </CardTitle>
          <CardDescription>
            OS call-log sync (Android when permitted). Phone numbers are masked. iOS shows
            UNAVAILABLE — use CRM dialer logs below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {osCallLogs.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : osCallLogs.isError ? (
            <p className="py-6 text-center text-sm text-destructive">
              Could not load device calls.
            </p>
          ) : osCallItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No device call-log metadata for this day.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Time (IST)</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 font-medium">Phone</th>
                    <th className="px-2 py-2 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {osCallItems.map((call) => (
                    <tr key={call.id} className="border-b border-border/60">
                      <td className="px-2 py-2 whitespace-nowrap">
                        {formatIstTime(call.callStartTime)}
                      </td>
                      <td className="px-2 py-2">{call.callType}</td>
                      <td className="px-2 py-2 font-mono text-xs">{call.phoneNumber ?? "—"}</td>
                      <td className="px-2 py-2">
                        {call.durationSeconds == null ? "—" : `${call.durationSeconds}s`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="calls">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-4 w-4" />
            CRM dialer calls
          </CardTitle>
          <CardDescription>Who this agent called or logged on {date} (IST)</CardDescription>
        </CardHeader>
        <CardContent>
          {calls.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : calls.isError ? (
            <p className="py-6 text-center text-sm text-destructive">Could not load calls.</p>
          ) : callItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No CRM call logs for this agent on this day.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Time (IST)</th>
                    <th className="px-2 py-2 font-medium">Who</th>
                    <th className="px-2 py-2 font-medium">Phone</th>
                    <th className="px-2 py-2 font-medium">Outcome</th>
                    <th className="px-2 py-2 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {callItems.map((call) => (
                    <tr key={call.id} className="border-b border-border/60">
                      <td className="px-2 py-2 whitespace-nowrap">
                        {formatIstTime(call.startedAt)}
                      </td>
                      <td className="px-2 py-2">
                        {call.lead ? (
                          <Link
                            href={`/leads/${call.lead.id}`}
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {callWhoLabel(call)}
                          </Link>
                        ) : (
                          callWhoLabel(call)
                        )}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{call.phoneNumber}</td>
                      <td className="px-2 py-2">{call.outcome ?? call.disposition ?? "—"}</td>
                      <td className="px-2 py-2">{call.durationSeconds}s</td>
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

export default function LocationHistoryPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <LocationHistoryContent />
    </Suspense>
  );
}
