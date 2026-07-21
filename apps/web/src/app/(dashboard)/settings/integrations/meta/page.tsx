"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { Badge } from "@/components/ui/badge";
import {
  useMetaAdAccounts,
  useMetaBusinesses,
  useMetaConnect,
  useMetaDashboard,
  useMetaDisconnect,
  useMetaForms,
  useMetaPages,
  useMetaPatchForm,
  useMetaPatchPage,
  useMetaPixels,
  useMetaReconnectPage,
  useMetaSync,
  useMetaSyncAssets,
  useMetaSyncHistory,
  useMetaTokenRefresh,
} from "@/hooks/use-meta";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { AlertTriangle, Link2, Link2Off, Megaphone, RefreshCw, Unplug } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

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

function EmptyRows({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

function MetaDashboardInner() {
  const { ready, hasPermission } = usePermissions();
  const canView = hasPermission("org_profile:view");
  const canManage = hasPermission("org_profile:update");
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<string | null>(null);

  const dashboard = useMetaDashboard({ enabled: ready && canView });
  const businesses = useMetaBusinesses({ enabled: ready && canView });
  const pages = useMetaPages({ enabled: ready && canView });
  const forms = useMetaForms({ enabled: ready && canView });
  const adAccounts = useMetaAdAccounts({ enabled: ready && canView });
  const pixels = useMetaPixels({ enabled: ready && canView });
  const syncHistory = useMetaSyncHistory({ enabled: ready && canView });
  const connect = useMetaConnect();
  const disconnect = useMetaDisconnect();
  const sync = useMetaSync();
  const syncAssets = useMetaSyncAssets();
  const refreshToken = useMetaTokenRefresh();
  const patchPage = useMetaPatchPage();
  const reconnectPage = useMetaReconnectPage();
  const patchForm = useMetaPatchForm();

  useEffect(() => {
    const meta = searchParams.get("meta");
    if (meta === "connected") setBanner("Meta Business account connected. Pages and forms synced.");
    if (meta === "error") setBanner("Meta connection failed. Check app credentials and try again.");
  }, [searchParams]);

  const formsByPage = useMemo(() => {
    const map = new Map<string, number>();
    for (const form of forms.data ?? []) {
      map.set(form.pageId, (map.get(form.pageId) ?? 0) + 1);
    }
    return map;
  }, [forms.data]);

  const lastSync = syncHistory.data?.[0] ?? null;

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
    connect.isPending ||
    disconnect.isPending ||
    sync.isPending ||
    syncAssets.isPending ||
    refreshToken.isPending ||
    patchPage.isPending ||
    reconnectPage.isPending ||
    patchForm.isPending;

  async function handleConnect() {
    const result = await connect.mutateAsync();
    if (result.url) window.location.href = result.url;
  }

  function refetchAll() {
    void dashboard.refetch();
    void businesses.refetch();
    void pages.refetch();
    void forms.refetch();
    void adAccounts.refetch();
    void pixels.refetch();
    void syncHistory.refetch();
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
            Meta Lead Ads
          </h1>
          <p className="text-sm text-muted-foreground">
            Multi-page OAuth connect, leadgen webhooks, forms, and sync — no hardcoded page tokens.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={dashboard.isFetching}
            onClick={refetchAll}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", dashboard.isFetching && "animate-spin")} />
            Refresh
          </Button>
          {canManage ? (
            <>
              <Button type="button" size="sm" disabled={busy} onClick={() => void handleConnect()}>
                <Link2 className="mr-2 h-4 w-4" />
                {data?.token.connected ? "Reconnect Meta" : "Connect Meta"}
              </Button>
              {data?.token.connected ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void syncAssets.mutateAsync()}
                  >
                    Sync Now
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void sync.mutateAsync({ type: "all" })}
                  >
                    Full sync
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
                      if (window.confirm("Disconnect Meta and deactivate pages?")) {
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
              Token: {data.token.connected ? (data.token.status ?? "active") : "Not connected"}
            </Badge>
            {data.token.expiresAt ? (
              <span className="text-sm text-muted-foreground">
                Expires {new Date(data.token.expiresAt).toLocaleString()}
              </span>
            ) : null}
            {data.token.expiringSoon ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Expiring soon
              </Badge>
            ) : null}
            {lastSync ? (
              <span className="text-sm text-muted-foreground">
                Last sync: {lastSync.syncType} · {lastSync.status} ·{" "}
                {new Date(lastSync.startedAt).toLocaleString()}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Last sync: never</span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi label="Businesses" value={data.assets.businesses} />
            <Kpi label="Pages" value={data.assets.pages} />
            <Kpi label="Lead forms" value={data.assets.forms} />
            <Kpi label="Pixels" value={data.assets.pixels} />
            <Kpi label="Ad accounts" value={data.assets.adAccounts} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Leads today" value={data.leads.today} />
            <Kpi label="Leads yesterday" value={data.leads.yesterday} />
            <Kpi label="Last 7 days" value={data.leads.last7Days} />
            <Kpi label="Last 30 days" value={data.leads.last30Days} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connected businesses</CardTitle>
              <CardDescription>Business Managers imported via OAuth.</CardDescription>
            </CardHeader>
            <CardContent>
              {(businesses.data ?? []).length === 0 ? (
                <EmptyRows message="No businesses yet. Click Connect Meta." />
              ) : (
                <ul className="space-y-2 text-sm">
                  {(businesses.data ?? []).map((biz) => (
                    <li
                      key={biz.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                    >
                      <div>
                        <p className="font-medium">{biz.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{biz.businessId}</p>
                      </div>
                      <Badge variant={biz.isActive ? "default" : "secondary"}>
                        {biz.verificationStatus ?? (biz.isActive ? "Active" : "Inactive")}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pages</CardTitle>
              <CardDescription>
                Enable/disable pages, reconnect tokens, and leadgen subscription status.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(pages.data ?? []).length === 0 ? (
                <EmptyRows message="No pages yet. Click Connect Meta, then Sync Now." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-3 font-medium">Page</th>
                        <th className="py-2 pr-3 font-medium">Token</th>
                        <th className="py-2 pr-3 font-medium">Leadgen</th>
                        <th className="py-2 pr-3 font-medium">Forms</th>
                        <th className="py-2 pr-3 font-medium">Active</th>
                        <th className="py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pages.data ?? []).map((page) => (
                        <tr key={page.id} className="border-b border-border/60">
                          <td className="py-2 pr-3">
                            <p className="font-medium">{page.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{page.pageId}</p>
                          </td>
                          <td className="py-2 pr-3">
                            <Badge variant={page.hasAccessToken ? "default" : "secondary"}>
                              {page.hasAccessToken ? "Stored" : "Missing"}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3">
                            <Badge variant={page.leadgenSubscribed ? "default" : "secondary"}>
                              {page.leadgenSubscribed ? "Subscribed" : "Not subscribed"}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3 tabular-nums">
                            {formsByPage.get(page.id) ?? 0}
                          </td>
                          <td className="py-2 pr-3">
                            <Badge
                              variant={page.isActive && page.isSelected ? "default" : "secondary"}
                            >
                              {page.isActive && page.isSelected ? "On" : "Off"}
                            </Badge>
                          </td>
                          <td className="py-2">
                            {canManage ? (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() =>
                                    void patchPage.mutateAsync({
                                      id: page.id,
                                      isActive: !(page.isActive && page.isSelected),
                                      isSelected: !(page.isActive && page.isSelected),
                                    })
                                  }
                                >
                                  {page.isActive && page.isSelected ? "Disable" : "Enable"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => void reconnectPage.mutateAsync(page.id)}
                                >
                                  Reconnect
                                </Button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead forms</CardTitle>
              <CardDescription>
                Forms linked to pages. Disable to stop ingest for that form.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(forms.data ?? []).length === 0 ? (
                <EmptyRows message="No forms synced yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-3 font-medium">Form</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 pr-3 font-medium">Active</th>
                        <th className="py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(forms.data ?? []).map((form) => (
                        <tr key={form.id} className="border-b border-border/60">
                          <td className="py-2 pr-3">
                            <p className="font-medium">{form.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{form.formId}</p>
                          </td>
                          <td className="py-2 pr-3">{form.status ?? "—"}</td>
                          <td className="py-2 pr-3">
                            <Badge
                              variant={form.isActive && form.isSelected ? "default" : "secondary"}
                            >
                              {form.isActive && form.isSelected ? "On" : "Off"}
                            </Badge>
                          </td>
                          <td className="py-2">
                            {canManage ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  void patchForm.mutateAsync({
                                    id: form.id,
                                    isActive: !(form.isActive && form.isSelected),
                                    isSelected: !(form.isActive && form.isSelected),
                                  })
                                }
                              >
                                {form.isActive && form.isSelected ? "Disable" : "Enable"}
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ad accounts</CardTitle>
              </CardHeader>
              <CardContent>
                {(adAccounts.data ?? []).length === 0 ? (
                  <EmptyRows message="No ad accounts synced yet." />
                ) : (
                  <ul className="space-y-2 text-sm">
                    {(adAccounts.data ?? []).map((account) => (
                      <li
                        key={account.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                      >
                        <div>
                          <p className="font-medium">{account.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {account.adAccountId}
                            {account.currency ? ` · ${account.currency}` : ""}
                          </p>
                        </div>
                        <Badge variant={account.isActive ? "default" : "secondary"}>
                          {account.isActive ? "Active" : "Off"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pixels</CardTitle>
              </CardHeader>
              <CardContent>
                {(pixels.data ?? []).length === 0 ? (
                  <EmptyRows message="No pixels synced yet." />
                ) : (
                  <ul className="space-y-2 text-sm">
                    {(pixels.data ?? []).map((pixel) => (
                      <li
                        key={pixel.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                      >
                        <div>
                          <p className="font-medium">{pixel.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{pixel.pixelId}</p>
                        </div>
                        <div className="flex gap-1">
                          {pixel.isDefault ? <Badge variant="outline">Default</Badge> : null}
                          <Badge variant={pixel.isActive ? "default" : "secondary"}>
                            {pixel.isActive ? "Active" : "Off"}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sync history</CardTitle>
                <CardDescription>Recent page/form and insights sync runs (every 6h).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(syncHistory.data ?? []).length === 0 ? (
                  <EmptyRows message="No sync history yet." />
                ) : (
                  (syncHistory.data ?? []).map((row) => (
                    <div
                      key={row.id}
                      className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {row.syncType} · {row.status}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(row.startedAt).toLocaleString()}
                          {row.errorMessage ? ` — ${row.errorMessage}` : ""}
                        </p>
                      </div>
                      <span className="tabular-nums text-muted-foreground">
                        {row.recordsProcessed}/{row.recordsFailed}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Webhook &amp; CAPI health</CardTitle>
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
                        Enable META_CAPI_ENABLED after connecting a pixel.
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
