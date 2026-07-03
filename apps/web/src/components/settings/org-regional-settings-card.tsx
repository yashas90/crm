"use client";

import { type OrgRecord, orgPatchErrorMessage, useUpdateOrg } from "@/hooks/use-org";
import {
  ORG_CURRENCY_OPTIONS,
  ORG_DATE_FORMAT_OPTIONS,
  ORG_LOCALE_OPTIONS,
  ORG_TIMEZONE_OPTIONS,
  resolveOrgFormatting,
} from "@/lib/org-settings";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { useEffect, useState } from "react";

const selectClassName = cn(
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

type OrgRegionalSettingsCardProps = {
  org?: OrgRecord;
  canUpdate: boolean;
};

export function OrgRegionalSettingsCard({ org, canUpdate }: OrgRegionalSettingsCardProps) {
  const updateOrg = useUpdateOrg();
  const [timezone, setTimezone] = useState("");
  const [locale, setLocale] = useState("");
  const [dateFormat, setDateFormat] = useState("");
  const [currency, setCurrency] = useState("");

  useEffect(() => {
    if (!org) return;
    const formatting = resolveOrgFormatting(org.settings);
    setTimezone(formatting.timezone);
    setLocale(formatting.locale);
    setDateFormat(formatting.dateFormat);
    setCurrency(formatting.currency);
  }, [org]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUpdate) return;
    updateOrg.mutate(
      {
        timezone: timezone.trim() || null,
        settings: {
          locale: locale.trim() || null,
          dateFormat: dateFormat.trim() || null,
          currency: currency.trim() || null,
        },
      },
      {
        onSuccess: () => toast.success("Regional settings saved."),
        onError: (error) =>
          toast.error(orgPatchErrorMessage(error, "Failed to update regional settings.")),
      },
    );
  }

  if (!org) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regional defaults</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading regional settings...</p>
        </CardContent>
      </Card>
    );
  }

  const formatting = resolveOrgFormatting(org.settings);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Regional defaults</CardTitle>
        <CardDescription>
          Timezone, locale, date format, and currency used across reports and money displays.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {canUpdate ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="org-timezone">Timezone</Label>
              <select
                id="org-timezone"
                className={selectClassName}
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              >
                {ORG_TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-locale">Locale</Label>
                <select
                  id="org-locale"
                  className={selectClassName}
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                >
                  {ORG_LOCALE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-currency">Currency</Label>
                <select
                  id="org-currency"
                  className={selectClassName}
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  {ORG_CURRENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-date-format">Date format</Label>
              <select
                id="org-date-format"
                className={selectClassName}
                value={dateFormat}
                onChange={(event) => setDateFormat(event.target.value)}
              >
                {ORG_DATE_FORMAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" disabled={updateOrg.isPending}>
              {updateOrg.isPending ? "Saving..." : "Save regional settings"}
            </Button>
          </form>
        ) : (
          <div className="space-y-2">
            <p>
              <span className="text-muted-foreground">Timezone:</span> {formatting.timezone}
            </p>
            <p>
              <span className="text-muted-foreground">Locale:</span> {formatting.locale}
            </p>
            <p>
              <span className="text-muted-foreground">Currency:</span> {formatting.currency}
            </p>
            <p>
              <span className="text-muted-foreground">Date format:</span> {formatting.dateFormat}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
