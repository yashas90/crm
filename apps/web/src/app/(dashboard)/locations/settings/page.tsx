"use client";

import { useSession } from "@/hooks/use-session";
import { apiGet, apiPatch } from "@/lib/apiClient";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type TrackingSettings = {
  enabled: boolean;
  timezone: string;
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  retentionDays: number;
  missingAlertMinutes: number;
  heartbeatThresholdMinutes: number;
  possibleUninstallMinutes: number;
  activeDays: number[];
  scheduleLabel: string;
};

export default function TrackingSettingsPage() {
  const { session, ready, isAdmin } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ready) return;
    if (!session || !isAdmin) router.replace("/");
  }, [ready, session, isAdmin, router]);

  const settings = useQuery({
    queryKey: ["locations", "settings"],
    queryFn: () => apiGet<TrackingSettings>("/api/locations/settings"),
    enabled: ready && isAdmin,
  });

  const [form, setForm] = useState<Partial<TrackingSettings>>({});
  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      await apiPatch("/api/locations/settings", {
        enabled: form.enabled,
        startTime: form.startTime,
        endTime: form.endTime,
        intervalMinutes: form.intervalMinutes,
        retentionDays: form.retentionDays,
        missingAlertMinutes: form.missingAlertMinutes,
        heartbeatThresholdMinutes: form.heartbeatThresholdMinutes,
        possibleUninstallMinutes: form.possibleUninstallMinutes,
        activeDays: form.activeDays,
        timezone: form.timezone,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["locations"] });
    },
  });

  if (!ready || !session || !isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/settings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Agent tracking settings</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin-only schedule and alert thresholds. Defaults come from API env; saving stores org
          overrides.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule & retention</CardTitle>
          <CardDescription>{settings.data?.scheduleLabel ?? "Loading…"}</CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-xl gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Tracking enabled</span>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.enabled === false ? "false" : "true"}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.value === "true" }))}
            >
              <option value="true">ON</option>
              <option value="false">OFF</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Start (HH:MM)</span>
            <Input
              value={form.startTime ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">End (HH:MM)</span>
            <Input
              value={form.endTime ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Interval (minutes)</span>
            <Input
              type="number"
              value={form.intervalMinutes ?? 30}
              onChange={(e) =>
                setForm((f) => ({ ...f, intervalMinutes: Number(e.target.value) || 30 }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Retention (days)</span>
            <Input
              type="number"
              value={form.retentionDays ?? 14}
              onChange={(e) =>
                setForm((f) => ({ ...f, retentionDays: Number(e.target.value) || 14 }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Missing location alert (min)</span>
            <Input
              type="number"
              value={form.missingAlertMinutes ?? 75}
              onChange={(e) =>
                setForm((f) => ({ ...f, missingAlertMinutes: Number(e.target.value) || 75 }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Heartbeat offline threshold (min)</span>
            <Input
              type="number"
              value={form.heartbeatThresholdMinutes ?? 60}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  heartbeatThresholdMinutes: Number(e.target.value) || 60,
                }))
              }
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Possible uninstall threshold (min)</span>
            <Input
              type="number"
              value={form.possibleUninstallMinutes ?? 180}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  possibleUninstallMinutes: Number(e.target.value) || 180,
                }))
              }
            />
          </label>
          <div className="sm:col-span-2">
            <Button
              type="button"
              disabled={save.isPending || settings.isLoading}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save settings"}
            </Button>
            {save.isSuccess ? (
              <p className="mt-2 text-xs text-emerald-600">Saved. Audit log recorded.</p>
            ) : null}
            {save.isError ? (
              <p className="mt-2 text-xs text-destructive">Could not save settings.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
