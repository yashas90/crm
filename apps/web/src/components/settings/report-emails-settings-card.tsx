"use client";

import { ApiRequestError, apiPatch, apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Label } from "@propninja/ui/label";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

type OrgRecord = {
  settings: Record<string, unknown>;
};

type ReportEmailsSettingsCardProps = {
  org?: OrgRecord;
  canUpdate: boolean;
  isAdmin: boolean;
  queryClient: QueryClient;
};

function readBooleanSetting(settings: Record<string, unknown>, key: string): boolean {
  const value = settings[key];
  return value === true || value === "true";
}

function readTimestamp(settings: Record<string, unknown>, key: string): string | null {
  const value = settings[key];
  return typeof value === "string" ? value : null;
}

export function ReportEmailsSettingsCard({
  org,
  canUpdate,
  isAdmin,
  queryClient,
}: ReportEmailsSettingsCardProps) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!org) return;
    setEnabled(readBooleanSetting(org.settings ?? {}, "reportEmailEnabled"));
  }, [org]);

  const saveReports = useMutation({
    mutationFn: (reportEmailEnabled: boolean) =>
      apiPatch("/api/org", { settings: { reportEmailEnabled } }),
    onSuccess: (data) => {
      queryClient.setQueryData(["org"], data);
      toast.success("Report email settings saved.");
    },
    onError: (error) => {
      const message =
        error instanceof ApiRequestError ? error.message : "Failed to update report emails.";
      toast.error(message);
    },
  });

  const sendTest = useMutation({
    mutationFn: () => apiPost<{ sent: boolean }>("/api/reports/send-test-email", {}),
    onSuccess: () => toast.success("Test report email sent."),
    onError: (error) => {
      const message =
        error instanceof ApiRequestError ? error.message : "Failed to send test email.";
      toast.error(message);
    },
  });

  const lastDaily = org ? readTimestamp(org.settings ?? {}, "reportEmailLastSentAt") : null;
  const lastWeekly = org ? readTimestamp(org.settings ?? {}, "reportEmailLastWeeklySentAt") : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Report emails</CardTitle>
        <CardDescription>
          Automated daily (8:00 AM IST) and weekly (Monday 8:00 AM IST) summaries for managers and
          admins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-muted/20 px-3 py-3 text-sm dark:border-white/10">
          <div>
            <Label htmlFor="report-emails-enabled" className="font-medium">
              Send daily summary email to all managers and admins
            </Label>
            <p className="text-xs text-muted-foreground">
              Weekly summaries are sent on Mondays when enabled.
            </p>
          </div>
          <input
            id="report-emails-enabled"
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={enabled}
            disabled={!canUpdate || saveReports.isPending}
            onChange={(event) => {
              const next = event.target.checked;
              setEnabled(next);
              if (canUpdate) saveReports.mutate(next);
            }}
          />
        </label>

        <div className="grid gap-2 rounded-lg border border-slate-200/80 bg-muted/10 p-3 text-sm dark:border-white/10">
          <p>
            <span className="text-muted-foreground">Last daily email:</span>{" "}
            {lastDaily ? new Date(lastDaily).toLocaleString() : "Never"}
          </p>
          <p>
            <span className="text-muted-foreground">Last weekly email:</span>{" "}
            {lastWeekly ? new Date(lastWeekly).toLocaleString() : "Never"}
          </p>
        </div>

        {isAdmin ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={sendTest.isPending}
            onClick={() => sendTest.mutate()}
          >
            {sendTest.isPending ? "Sending..." : "Send test email now"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
