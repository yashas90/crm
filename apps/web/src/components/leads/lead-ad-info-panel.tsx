"use client";

import { Badge } from "@/components/ui/badge";
import {
  type AdLeadCustomFields,
  formatLeadSourceDisplay,
  getAdLeadInfo,
  isAdLeadLead,
} from "@/lib/lead-sources";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Megaphone } from "lucide-react";

type LeadAdInfoPanelProps = {
  leadSource: string | null;
  tags?: string[] | null;
  customFields?: Record<string, unknown> | null;
};

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right font-medium">{value}</span>
    </div>
  );
}

function platformLabel(payload: AdLeadCustomFields | null, leadSource: string | null) {
  if (payload?.source === "facebook_ads") return "Facebook Ads";
  if (payload?.source === "google_ads") return "Google Ads";
  return formatLeadSourceDisplay(leadSource);
}

export function LeadAdInfoPanel({ leadSource, tags, customFields }: LeadAdInfoPanelProps) {
  const isAdLead = isAdLeadLead({ leadSource, tags });
  if (!isAdLead) return null;

  const { payload, ingestedAt } = getAdLeadInfo(customFields);

  return (
    <Card className="rounded-xl border-blue-200/60 bg-blue-50/40 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Ad lead
          <Badge variant="secondary" className="ml-1 font-normal">
            {platformLabel(payload, leadSource)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <MetaRow label="Campaign" value={payload?.campaignName ?? undefined} />
        <MetaRow label="Ad set" value={payload?.adsetName ?? undefined} />
        <MetaRow label="Form" value={payload?.formName ?? undefined} />
        <MetaRow label="External ID" value={payload?.externalLeadId ?? undefined} />
        {ingestedAt ? (
          <MetaRow
            label="Last ingested"
            value={new Date(ingestedAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
