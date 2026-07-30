"use client";

import { useSession } from "@/hooks/use-session";
import { apiGet } from "@/lib/apiClient";
import type { LocationHistoryItem } from "@propninja/types";
import { getIstDateKey } from "@propninja/types/ist";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function formatIstTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function LocationHistoryContent() {
  const { session, ready, isAdmin, isManager } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") ?? "";
  const [date, setDate] = useState(() => getIstDateKey());

  useEffect(() => {
    if (!ready) return;
    if (!session || (!isAdmin && !isManager)) {
      router.replace("/");
    }
  }, [ready, session, isAdmin, isManager, router]);

  const userQuery = useQuery({
    queryKey: ["users", userId],
    queryFn: () => apiGet<{ id: string; name: string; email: string }>(`/api/users/${userId}`),
    enabled: ready && (isAdmin || isManager) && Boolean(userId),
  });

  const history = useQuery({
    queryKey: ["locations", "history", userId, date],
    queryFn: () =>
      apiGet<{ items: LocationHistoryItem[]; total: number }>(
        `/api/locations/history?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`,
      ),
    enabled: ready && (isAdmin || isManager) && Boolean(userId),
  });

  if (!ready || !session || (!isAdmin && !isManager)) {
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
  const total = history.data?.total ?? items.length;
  const agentName = userQuery.data?.name ?? "Agent";

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
            <h1 className="text-2xl font-bold tracking-tight">{agentName} history</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {userQuery.data?.email ?? userId} · {total} ping{total === 1 ? "" : "s"} on {date}
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Location pings</CardTitle>
          <CardDescription>Ordered by time (IST)</CardDescription>
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
