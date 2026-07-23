"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { Badge } from "@/components/ui/badge";
import { type MetaLiveLead, useMetaLiveLeads, useMetaWebhookHealth } from "@/hooks/use-meta";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { Radio } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function healthBadge(status: "healthy" | "delayed" | "offline") {
  if (status === "healthy") {
    return { label: "Healthy", className: "bg-emerald-600 text-white" };
  }
  if (status === "delayed") {
    return { label: "Delayed", className: "bg-amber-500 text-white" };
  }
  return { label: "Offline", className: "bg-rose-600 text-white" };
}

function LiveRow({ lead }: { lead: MetaLiveLead }) {
  return (
    <tr className="border-b border-border/60 text-sm">
      <td className="py-2 pr-3 font-medium">{lead.fullName ?? "—"}</td>
      <td className="py-2 pr-3">{lead.assignedName ?? "Unassigned"}</td>
      <td className="py-2 pr-3">{lead.projectName ?? "—"}</td>
      <td className="py-2 pr-3">{lead.campaignName ?? "—"}</td>
      <td className="py-2 pr-3">{lead.adName ?? "—"}</td>
      <td className="py-2 pr-3">{lead.adsetName ?? "—"}</td>
      <td className="py-2 pr-3">{lead.formName ?? "—"}</td>
      <td className="py-2 pr-3">{lead.source}</td>
      <td className="py-2 pr-3">{new Date(lead.ingestedAt).toLocaleString()}</td>
      <td className="py-2">
        <Badge variant="secondary">{lead.leadStatus}</Badge>
      </td>
    </tr>
  );
}

export default function MetaLiveLeadsPage() {
  const { ready, hasPermission } = usePermissions();
  const canView = hasPermission("org_profile:view");
  const health = useMetaWebhookHealth({ enabled: ready && canView });
  const live = useMetaLiveLeads({ enabled: ready && canView });
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    const items = live.data ?? [];
    if (items[0]?.leadId && items[0].leadId !== flashId) {
      setFlashId(items[0].leadId);
    }
  }, [live.data, flashId]);

  if (ready && !canView) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-bold tracking-tight">Live Meta Leads</h1>
        <AccessDeniedEmptyState />
      </div>
    );
  }

  const badge = healthBadge(health.data?.status ?? "offline");

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Radio className="h-6 w-6 text-rose-500" />
            Live Meta Leads
          </h1>
          <p className="text-sm text-muted-foreground">
            Webhooks are primary. Dashboard auto-refreshes every 5 seconds. Reconciliation runs every
            5 minutes as backup only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={cn("gap-1", badge.className)}>{badge.label}</Badge>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/meta">Meta settings</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Webhook status</CardDescription>
            <CardTitle className="text-base">{health.data?.label ?? "Loading…"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Processed (15m)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {health.data?.processedLast15m ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg processing</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {health.data?.avgProcessingMs != null ? `${health.data.avgProcessingMs} ms` : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recovered (24h)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {health.data?.recoveredLeadsLast24h ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incoming leads</CardTitle>
          <CardDescription>
            Last success {health.data?.lastSuccessAt
              ? new Date(health.data.lastSuccessAt).toLocaleString()
              : "—"}{" "}
            · Queue {health.data?.queuedOrProcessing ?? 0} · Durable jobs{" "}
            {health.data?.durableJobsEnabled ? "on" : "off (in-process fallback)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {(live.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No Meta leads in the last 24 hours yet. Submit a test Lead Ad or wait for webhooks /
              5‑minute reconciliation.
            </p>
          ) : (
            <table className="w-full min-w-[960px] text-left">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">Lead</th>
                  <th className="py-2 pr-3 font-medium">Owner</th>
                  <th className="py-2 pr-3 font-medium">Project</th>
                  <th className="py-2 pr-3 font-medium">Campaign</th>
                  <th className="py-2 pr-3 font-medium">Ad</th>
                  <th className="py-2 pr-3 font-medium">Adset</th>
                  <th className="py-2 pr-3 font-medium">Form</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Created</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(live.data ?? []).map((lead) => (
                  <LiveRow key={`${lead.leadId}-${lead.leadgenId}`} lead={lead} />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
