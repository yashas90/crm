"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { Badge } from "@/components/ui/badge";
import {
  useMetaConnect,
  useMetaDashboard,
  useMetaDisconnect,
  useMetaSync,
  useMetaTokenRefresh,
} from "@/hooks/use-meta";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { AlertTriangle, Link2, Link2Off, Megaphone, RefreshCw, Unplug } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function MetaDashboardInner() {
  const { ready, hasPermission } = usePermissions();
  const canView = hasPermission("org_profile:view");
  const canManage = hasPermission("org_profile:update");
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<string | null>(null);

  const dashboard = useMetaDashboard({ enabled: ready && canView });
  const connect = useMetaConnect();
  const disconnect = useMetaDisconnect();
  const sync = useMetaSync();
  const refreshToken = useMetaTokenRefresh();

  useEffect(() => {
    const meta = searchParams.get("meta");
    if (meta === "connected") setBanner("Meta Business account connected successfully.");
    if (meta === "error") setBanner("Meta connection failed. Check app credentials and try again.");
  }, [searchParams]);

  if (ready && !canView) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Meta Business</h1>
        <AccessDeniedEmptyState />
      </div>
    );
  }

  const data = dashboard.data;
  const busy =
    connect.isPending || disconnect.isPending || sync.isPending || refreshToken.isPending;

  async function handleConnect() {
    const result = await connect.mutateAsync();
    if (result.url) {
      window.location.href = result.url;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/settings" className="hover:text-foreground hover:underline">
              Settings
            </Link>
            <span className="mx-2 text-muted-foreground/70">/</span>
            <Link href="/settings/integrations" className="hover:text-foreground hover:underline">
              Integrations
            </Link>
            <span className="mx-2 text-muted-foreground/70">/</span>
            <span className="text-foreground">Meta</span>
          </nav>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Megaphone className="h-6 w-6" />
            Meta Business
          </h1>
          <p className="text-sm text-muted-foreground">
            Connect Business Manager, sync Lead Ads, pixels, and campaign insights.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={dashboard.isFetching}
            onClick={() => void dashboard.refetch()}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", dashboard.isFetching && "animate-spin")} />
            Refresh
          </Button>
          {canManage ? (
            <>
              <Button type="button" size="sm" disabled={busy} onClick={() => void handleConnect()}>
                <Link2 className="mr-2 h-4 w-4" />
                {data?.token.connected ? "Reconnect" : "Connect Meta"}
              </Button>
              {data?.token.connected ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void sync.mutateAsync({ type: "all" })}
                  >
                    Sync now
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void refreshToken.mutateAsync()}
                  >
                    Refresh token
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Disconnect Meta and deactivate stored assets?")) {
                        void disconnect.mutateAsync();
                      }
                    }}
                  >
                    <Unplug className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {banner ? (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          {banner}
        </div>
      ) : null}

      {dashboard.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Card key={`meta-skel-${String(i)}`}>
              <CardHeader>
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-8 w-16 animate-pulse rounded bg-muted" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={data.token.connected ? "default" : "secondary"}>
              {data.token.connected ? "Connected" : "Not connected"}
            </Badge>
            {data.token.expiresAt ? (
              <span className="text-sm text-muted-foreground">
                Token expires {new Date(data.token.expiresAt).toLocaleString()}
              </span>
            ) : null}
            {data.token.expiringSoon ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Expiring soon
              </Badge>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi label="Businesses" value={data.assets.businesses} />
            <Kpi label="Pages" value={data.assets.pages} />
            <Kpi label="Pixels" value={data.assets.pixels} />
            <Kpi label="Lead forms" value={data.assets.forms} />
            <Kpi label="Ad accounts" value={data.assets.adAccounts} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Leads today" value={data.leads.today} />
            <Kpi label="Leads yesterday" value={data.leads.yesterday} />
            <Kpi label="Last 7 days" value={data.leads.last7Days} />
            <Kpi label="Last 30 days" value={data.leads.last30Days} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top campaigns</CardTitle>
                <CardDescription>By recent spend / sync insights.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.topCampaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No campaigns synced yet. Connect Meta and run Sync.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {data.topCampaigns.map((campaign) => (
                      <li
                        key={campaign.id}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground">{campaign.campaignId}</p>
                        </div>
                        <span className="tabular-nums text-muted-foreground">
                          {campaign.spend.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pipeline health</CardTitle>
                <CardDescription>Webhook deliveries and Conversion API queue.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium">Webhooks</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(data.webhooks).map(([status, count]) => (
                      <Badge key={status} variant="secondary">
                        {status}: {count}
                      </Badge>
                    ))}
                    {Object.keys(data.webhooks).length === 0 ? (
                      <span className="text-sm text-muted-foreground">No webhook traffic yet.</span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Conversion events</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(data.conversionEvents).map(([status, count]) => (
                      <Badge key={status} variant="secondary">
                        {status}: {count}
                      </Badge>
                    ))}
                    {Object.keys(data.conversionEvents).length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        Enable META_CAPI_ENABLED and select a pixel to send events.
                      </span>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Link2Off className="h-4 w-4" />
            Unable to load Meta dashboard.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function MetaSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-1">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        </div>
      }
    >
      <MetaDashboardInner />
    </Suspense>
  );
}
