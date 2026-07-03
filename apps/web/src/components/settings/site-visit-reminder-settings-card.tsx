"use client";

import { type OrgRecord, orgPatchErrorMessage, useUpdateOrg } from "@/hooks/use-org";
import { DEFAULT_SITE_VISIT_REMINDER_MINUTES } from "@/lib/site-visit-reminders";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useEffect, useState } from "react";

type SiteVisitReminderSettingsCardProps = {
  org?: OrgRecord;
  canUpdate: boolean;
};

function parseReminderInput(value: string): number[] {
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function SiteVisitReminderSettingsCard({
  org,
  canUpdate,
}: SiteVisitReminderSettingsCardProps) {
  const updateOrg = useUpdateOrg();
  const [minutesInput, setMinutesInput] = useState(DEFAULT_SITE_VISIT_REMINDER_MINUTES.join(", "));

  useEffect(() => {
    if (!org) return;
    const raw = org.settings?.siteVisitReminderMinutes;
    if (Array.isArray(raw) && raw.length > 0) {
      setMinutesInput(raw.map(String).join(", "));
    } else {
      setMinutesInput(DEFAULT_SITE_VISIT_REMINDER_MINUTES.join(", "));
    }
  }, [org]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUpdate) return;
    const minutes = parseReminderInput(minutesInput);
    if (minutes.length === 0) {
      toast.error("Enter at least one reminder interval in minutes.");
      return;
    }
    updateOrg.mutate(
      { settings: { siteVisitReminderMinutes: minutes } },
      {
        onSuccess: () => toast.success("Site visit reminder timings saved."),
        onError: (error) =>
          toast.error(orgPatchErrorMessage(error, "Failed to save reminder settings.")),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Site visit reminders</CardTitle>
        <CardDescription>
          WhatsApp reminders are sent this many minutes before each scheduled visit
          (comma-separated). Default: 24h, 2h, 30min.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="site-visit-reminder-minutes">Reminder intervals (minutes)</Label>
            <Input
              id="site-visit-reminder-minutes"
              value={minutesInput}
              onChange={(e) => setMinutesInput(e.target.value)}
              placeholder="1440, 120, 30"
              disabled={!canUpdate}
            />
          </div>
          {canUpdate ? (
            <Button type="submit" size="sm" disabled={updateOrg.isPending}>
              {updateOrg.isPending ? "Saving…" : "Save reminders"}
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
