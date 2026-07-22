"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type MetaAd,
  type MetaAdAccount,
  type MetaAdset,
  type MetaCampaign,
  type MetaForm,
  useMetaAdAccounts,
  useMetaAds,
  useMetaAdsets,
  useMetaBusinesses,
  useMetaCampaigns,
  useMetaConnect,
  useMetaDashboard,
  useMetaDisconnect,
  useMetaForms,
  useMetaPages,
  useMetaPatchForm,
  useMetaPatchPage,
  useMetaReconnectPage,
  useMetaSync,
  useMetaSyncAssets,
  useMetaSyncHistory,
  useMetaSyncLeads,
  useMetaTokenRefresh,
} from "@/hooks/use-meta";
import { usePermissions } from "@/hooks/use-permissions";
import { useProjects } from "@/hooks/use-projects";
import { apiGet } from "@/lib/apiClient";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Link2,
  Link2Off,
  Megaphone,
  RefreshCw,
  Search,
  Unplug,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

type MetaTab = "accounts" | "pages" | "forms" | "ads";
type AssigneeMode = "selected" | "all";

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
  return <p className="py-6 text-center text-sm text-muted-foreground">{message}</p>;
}

function StatusBadge({ active, label }: { active: boolean; label?: string }) {
  return (
    <Badge variant={active ? "default" : "secondary"}>{label ?? (active ? "ACTIVE" : "OFF")}</Badge>
  );
}

function MetaDashboardInner() {
  const { ready, hasPermission } = usePermissions();
  const canView = hasPermission("org_profile:view");
  const canManage = hasPermission("org_profile:update");
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<string | null>(null);
  const [tab, setTab] = useState<MetaTab>("accounts");
  const [search, setSearch] = useState("");
  const [mappingForm, setMappingForm] = useState<MetaForm | null>(null);
  const [mappingProjectId, setMappingProjectId] = useState<string>("");
  const [mappingAssigneeIds, setMappingAssigneeIds] = useState<string[]>([]);
  const [mappingStrategy, setMappingStrategy] = useState<"round_robin" | "first">("round_robin");
  const [mappingAssigneeMode, setMappingAssigneeMode] = useState<AssigneeMode>("selected");

  const dashboard = useMetaDashboard({ enabled: ready && canView });
  const businesses = useMetaBusinesses({ enabled: ready && canView });
  const pages = useMetaPages({ enabled: ready && canView });
  const forms = useMetaForms({ enabled: ready && canView });
  const adAccounts = useMetaAdAccounts({ enabled: ready && canView });
  const campaigns = useMetaCampaigns({ enabled: ready && canView && tab === "ads" });
  const adsets = useMetaAdsets({ enabled: ready && canView && tab === "ads" });
  const ads = useMetaAds({ enabled: ready && canView && tab === "ads" });
  const syncHistory = useMetaSyncHistory({ enabled: ready && canView });
  const projects = useProjects();
  const assignableUsers = useQuery({
    queryKey: ["users", "meta-assignees"],
    queryFn: () =>
      apiGet<{ items: Array<{ id: string; name: string; role: string }> }>(
        "/api/users?pageSize=200",
      ),
    enabled: ready && canManage,
    select: (d) => d.items.filter((u) => u.role === "agent" || u.role === "manager"),
  });
  const allAssignableIds = useMemo(
    () => (assignableUsers.data ?? []).map((u) => u.id),
    [assignableUsers.data],
  );
  const connect = useMetaConnect();
  const disconnect = useMetaDisconnect();
  const sync = useMetaSync();
  const syncAssets = useMetaSyncAssets();
  const syncLeads = useMetaSyncLeads();
  const refreshToken = useMetaTokenRefresh();
  const patchPage = useMetaPatchPage();
  const reconnectPage = useMetaReconnectPage();
  const patchForm = useMetaPatchForm();

  useEffect(() => {
    const meta = searchParams.get("meta");
    if (meta === "connected") setBanner("Meta Business account connected. Pages and forms synced.");
    if (meta === "error") setBanner("Meta connection failed. Check app credentials and try again.");
  }, [searchParams]);

  useEffect(() => {
    if (!mappingForm) return;
    const saved = mappingForm.assigneeIds ?? [];
    setMappingProjectId(mappingForm.projectId ?? "");
    setMappingAssigneeIds(saved);
    setMappingStrategy(mappingForm.assignmentStrategy ?? "round_robin");
    const isAll =
      allAssignableIds.length > 0 &&
      saved.length === allAssignableIds.length &&
      allAssignableIds.every((id) => saved.includes(id));
    setMappingAssigneeMode(isAll ? "all" : "selected");
  }, [mappingForm, allAssignableIds]);

  const pageNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const page of pages.data ?? []) map.set(page.id, page.name);
    return map;
  }, [pages.data]);

  const pageMetaIdById = useMemo(() => {
    const map = new Map<string, string>();
    for (const page of pages.data ?? []) map.set(page.id, page.pageId);
    return map;
  }, [pages.data]);

  const formsByPage = useMemo(() => {
    const map = new Map<string, number>();
    for (const form of forms.data ?? []) {
      map.set(form.pageId, (map.get(form.pageId) ?? 0) + 1);
    }
    return map;
  }, [forms.data]);

  const campaignById = useMemo(() => {
    const map = new Map<string, MetaCampaign>();
    for (const row of campaigns.data ?? []) map.set(row.id, row);
    return map;
  }, [campaigns.data]);

  const adsetById = useMemo(() => {
    const map = new Map<string, MetaAdset>();
    for (const row of adsets.data ?? []) map.set(row.id, row);
    return map;
  }, [adsets.data]);

  const accountById = useMemo(() => {
    const map = new Map<string, MetaAdAccount>();
    for (const row of adAccounts.data ?? []) map.set(row.id, row);
    return map;
  }, [adAccounts.data]);

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects.data ?? []) map.set(project.id, project.name);
    return map;
  }, [projects.data]);

  const q = search.trim().toLowerCase();

  const filteredAccounts = useMemo(() => {
    const rows = adAccounts.data ?? [];
    if (!q) return rows;
    return rows.filter(
      (row) => row.name.toLowerCase().includes(q) || row.adAccountId.toLowerCase().includes(q),
    );
  }, [adAccounts.data, q]);

  const filteredPages = useMemo(() => {
    const rows = pages.data ?? [];
    if (!q) return rows;
    return rows.filter(
      (row) => row.name.toLowerCase().includes(q) || row.pageId.toLowerCase().includes(q),
    );
  }, [pages.data, q]);

  const filteredForms = useMemo(() => {
    const rows = forms.data ?? [];
    if (!q) return rows;
    return rows.filter((row) => {
      const pageName = pageNameById.get(row.pageId) ?? "";
      return (
        row.name.toLowerCase().includes(q) ||
        row.formId.toLowerCase().includes(q) ||
        pageName.toLowerCase().includes(q)
      );
    });
  }, [forms.data, pageNameById, q]);

  const filteredAds = useMemo(() => {
    const rows = ads.data ?? [];
    if (!q) return rows;
    return rows.filter((row) => {
      const adset = row.adsetId ? adsetById.get(row.adsetId) : undefined;
      const campaign = adset?.campaignId ? campaignById.get(adset.campaignId) : undefined;
      return (
        row.name.toLowerCase().includes(q) ||
        row.adId.toLowerCase().includes(q) ||
        (adset?.name ?? "").toLowerCase().includes(q) ||
        (campaign?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [ads.data, adsetById, campaignById, q]);

  const lastSync = syncHistory.data?.[0] ?? null;
  const connected =
    Boolean(dashboard.data?.token.connected) ||
    (pages.data?.length ?? 0) > 0 ||
    (businesses.data?.length ?? 0) > 0 ||
    (adAccounts.data?.length ?? 0) > 0;

  const assetsLoading =
    pages.isLoading || forms.isLoading || adAccounts.isLoading || businesses.isLoading;

  if (ready && !canView) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Meta Business</h1>
        <AccessDeniedEmptyState />
      </div>
    );
  }

  const busy =
    connect.isPending ||
    disconnect.isPending ||
    sync.isPending ||
    syncAssets.isPending ||
    syncLeads.isPending ||
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
    void campaigns.refetch();
    void adsets.refetch();
    void ads.refetch();
    void syncHistory.refetch();
  }

  async function saveFormAssignment() {
    if (!mappingForm) return;
    const assigneeIds =
      mappingAssigneeMode === "all" ? allAssignableIds : mappingAssigneeIds;
    if (mappingAssigneeMode === "all" && assigneeIds.length === 0) {
      setBanner("No agents/managers to assign. Add users first.");
      return;
    }
    if (mappingAssigneeMode === "selected" && assigneeIds.length === 0) {
      setBanner("Select at least one user, or choose All users.");
      return;
    }
    await patchForm.mutateAsync({
      id: mappingForm.id,
      projectId: mappingProjectId || null,
      assigneeIds,
      assignmentStrategy: mappingStrategy,
      isActive: true,
      isSelected: true,
    });
    const strategyLabel =
      mappingStrategy === "round_robin" ? "round-robin" : "always first";
    setBanner(
      mappingAssigneeMode === "all"
        ? `Assigned — new Meta leads from this form go to all users (${strategyLabel}).`
        : `Assigned — new Meta leads from this form go to ${assigneeIds.length} user(s) (${strategyLabel}).`,
    );
    setMappingForm(null);
  }

  async function clearFormAssignment() {
    if (!mappingForm) return;
    await patchForm.mutateAsync({
      id: mappingForm.id,
      projectId: mappingProjectId || null,
      assigneeIds: [],
      assignmentStrategy: "round_robin",
      isActive: true,
      isSelected: true,
    });
    setBanner("Assignees cleared — global Assignment Rules apply for this form.");
    setMappingForm(null);
  }

  function toggleMappingAssignee(userId: string) {
    setMappingAssigneeMode("selected");
    setMappingAssigneeIds((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId],
    );
  }

  function selectAllAssignees() {
    setMappingAssigneeMode("all");
    setMappingAssigneeIds(allAssignableIds);
  }

  function selectSpecificAssignees() {
    setMappingAssigneeMode("selected");
  }

  function assigneeSummary(form: MetaForm): string {
    const ids = form.assigneeIds ?? [];
    if (ids.length === 0) return "—";
    const strategy = form.assignmentStrategy === "first" ? "first" : "RR";
    const isAll =
      allAssignableIds.length > 0 &&
      ids.length === allAssignableIds.length &&
      allAssignableIds.every((id) => ids.includes(id));
    if (isAll) return `All users · ${strategy}`;
    return `${ids.length} user${ids.length === 1 ? "" : "s"} · ${strategy}`;
  }

  const tabs: Array<{ id: MetaTab; label: string; count: number }> = [
    { id: "accounts", label: "Accounts", count: adAccounts.data?.length ?? 0 },
    { id: "pages", label: "Pages", count: pages.data?.length ?? 0 },
    { id: "forms", label: "Forms", count: forms.data?.length ?? 0 },
    { id: "ads", label: "Ads", count: ads.data?.length ?? 0 },
  ];

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
            Connected accounts, lead forms, and ads — map forms to projects for CRM ingest.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={dashboard.isFetching || pages.isFetching}
            onClick={refetchAll}
          >
            <RefreshCw
              className={cn(
                "mr-2 h-4 w-4",
                (dashboard.isFetching || pages.isFetching) && "animate-spin",
              )}
            />
            Refresh
          </Button>
          {canManage ? (
            <>
              <Button type="button" size="sm" disabled={busy} onClick={() => void handleConnect()}>
                <Link2 className="mr-2 h-4 w-4" />
                {connected ? "Reconnect Meta" : "Connect Meta"}
              </Button>
              {connected ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void syncAssets.mutateAsync()}
                  >
                    Sync assets
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
                    onClick={async () => {
                      const result = await syncLeads.mutateAsync(7);
                      setBanner(
                        `Pulled Meta leads (7d): ${result.ingested} ingested, ${result.skipped} already present, ${result.failed} failed (${result.leadsSeen} seen).`,
                      );
                    }}
                  >
                    Pull leads (7d)
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

      {dashboard.isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Dashboard summary failed to load. Asset tables below still work — try Refresh.
        </div>
      ) : null}

      {assetsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={`meta-skel-${String(i)}`}>
              <CardHeader>
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-8 w-16 animate-pulse rounded bg-muted" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={connected ? "default" : "secondary"}>
              {connected ? "Connected" : "Not connected"}
            </Badge>
            {dashboard.data?.token.expiresAt ? (
              <span className="text-sm text-muted-foreground">
                Token expires {new Date(dashboard.data.token.expiresAt).toLocaleString()}
              </span>
            ) : null}
            {dashboard.data?.token.expiringSoon ? (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Expiring soon
              </Badge>
            ) : null}
            {lastSync ? (
              <span className="text-sm text-muted-foreground">
                Last sync: {lastSync.syncType} · {lastSync.status} ·{" "}
                {new Date(lastSync.startedAt).toLocaleString()}
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi label="Businesses" value={businesses.data?.length ?? 0} />
            <Kpi label="Ad accounts" value={adAccounts.data?.length ?? 0} />
            <Kpi label="Pages" value={pages.data?.length ?? 0} />
            <Kpi label="Lead forms" value={forms.data?.length ?? 0} />
            <Kpi label="Leads (30d)" value={dashboard.data?.leads.last30Days ?? 0} />
          </div>

          {connected && (dashboard.data?.leads.last30Days ?? 0) === 0 ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              No live Meta Lead Ads have been received via webhook yet. Pages are connected, but
              Meta may not be delivering events — click <strong>Pull leads (7d)</strong> to import
              recent form submissions from Graph, and confirm the app webhook callback is{" "}
              <code className="text-xs">
                https://crm-production-e81d.up.railway.app/api/integrations/meta/webhook
              </code>{" "}
              (Page → leadgen) in Meta Developer Console.
            </div>
          ) : null}

          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Meta assets</CardTitle>
                <CardDescription>
                  Browse accounts, pages, lead forms, and synced ads.
                </CardDescription>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type to search"
                  className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {tabs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      tab === item.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label} ({item.count})
                  </button>
                ))}
              </div>

              {tab === "accounts" ? (
                filteredAccounts.length === 0 ? (
                  <EmptyRows message="No ad accounts yet. Connect Meta, then Sync assets." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 pr-3 font-medium">Account name</th>
                          <th className="py-2 pr-3 font-medium">Account ID</th>
                          <th className="py-2 pr-3 font-medium">Currency</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                          <th className="py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAccounts.map((account) => (
                          <tr key={account.id} className="border-b border-border/60">
                            <td className="py-3 pr-3 font-medium">{account.name}</td>
                            <td className="py-3 pr-3 font-mono text-xs text-muted-foreground">
                              {account.adAccountId}
                            </td>
                            <td className="py-3 pr-3">{account.currency ?? "—"}</td>
                            <td className="py-3 pr-3">
                              <StatusBadge active={account.isActive && account.isSelected} />
                            </td>
                            <td className="py-3">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setTab("ads");
                                  setSearch(account.name);
                                }}
                              >
                                View ads
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : null}

              {tab === "pages" ? (
                filteredPages.length === 0 ? (
                  <EmptyRows message="No pages yet. Connect Meta, then Sync assets." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 pr-3 font-medium">Page</th>
                          <th className="py-2 pr-3 font-medium">Page ID</th>
                          <th className="py-2 pr-3 font-medium">Leadgen</th>
                          <th className="py-2 pr-3 font-medium">Forms</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                          <th className="py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPages.map((page) => (
                          <tr key={page.id} className="border-b border-border/60">
                            <td className="py-3 pr-3 font-medium">{page.name}</td>
                            <td className="py-3 pr-3 font-mono text-xs text-muted-foreground">
                              {page.pageId}
                            </td>
                            <td className="py-3 pr-3">
                              <StatusBadge
                                active={page.leadgenSubscribed}
                                label={page.leadgenSubscribed ? "Subscribed" : "No"}
                              />
                            </td>
                            <td className="py-3 pr-3 tabular-nums">
                              {formsByPage.get(page.id) ?? 0}
                            </td>
                            <td className="py-3 pr-3">
                              <StatusBadge active={page.isActive && page.isSelected} />
                            </td>
                            <td className="py-3">
                              <div className="flex flex-wrap gap-2">
                                {canManage ? (
                                  <>
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
                                  </>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : null}

              {tab === "forms" ? (
                filteredForms.length === 0 ? (
                  <EmptyRows message="No lead forms yet. Sync assets after connecting Meta." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left text-sm">
                      <thead className="text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 pr-3 font-medium">Lead form</th>
                          <th className="py-2 pr-3 font-medium">Form ID</th>
                          <th className="py-2 pr-3 font-medium">Page name</th>
                          <th className="py-2 pr-3 font-medium">Project</th>
                          <th className="py-2 pr-3 font-medium">Assignees</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                          <th className="py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredForms.map((form) => (
                          <tr key={form.id} className="border-b border-border/60">
                            <td className="py-3 pr-3 font-medium">{form.name}</td>
                            <td className="py-3 pr-3 font-mono text-xs text-muted-foreground">
                              {form.formId}
                            </td>
                            <td className="py-3 pr-3">
                              {pageNameById.get(form.pageId) ??
                                pageMetaIdById.get(form.pageId) ??
                                "—"}
                            </td>
                            <td className="py-3 pr-3">
                              {form.projectId
                                ? (projectNameById.get(form.projectId) ?? "Mapped")
                                : "—"}
                            </td>
                            <td className="py-3 pr-3 text-xs text-muted-foreground">
                              {assigneeSummary(form)}
                            </td>
                            <td className="py-3 pr-3">
                              <StatusBadge
                                active={(form.status ?? "").toUpperCase() === "ACTIVE"}
                                label={form.status ?? (form.isActive ? "ACTIVE" : "OFF")}
                              />
                            </td>
                            <td className="py-3">
                              <div className="flex flex-wrap gap-2">
                                {canManage ? (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => setMappingForm(form)}
                                    >
                                      <UserPlus className="mr-1 h-3.5 w-3.5" />
                                      Assign
                                    </Button>
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
                                  </>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : null}

              {tab === "ads" ? (
                ads.isLoading || campaigns.isLoading || adsets.isLoading ? (
                  <EmptyRows message="Loading ads…" />
                ) : filteredAds.length === 0 ? (
                  <div className="space-y-3 py-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      No ads synced yet. Run <span className="font-medium">Full sync</span> to
                      import campaigns, ad sets, and ads.
                    </p>
                    {canManage && connected ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void sync.mutateAsync({ type: "all" })}
                      >
                        Full sync now
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[960px] text-left text-sm">
                      <thead className="text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 pr-3 font-medium">Ad</th>
                          <th className="py-2 pr-3 font-medium">Ad set</th>
                          <th className="py-2 pr-3 font-medium">Campaign</th>
                          <th className="py-2 pr-3 font-medium">Ad account</th>
                          <th className="py-2 pr-3 font-medium">Budget</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAds.map((ad: MetaAd) => {
                          const adset = ad.adsetId ? adsetById.get(ad.adsetId) : undefined;
                          const campaign = adset?.campaignId
                            ? campaignById.get(adset.campaignId)
                            : undefined;
                          const account = campaign?.adAccountId
                            ? accountById.get(campaign.adAccountId)
                            : undefined;
                          const budget = adset?.dailyBudget
                            ? `${account?.currency ?? "INR"} ${adset.dailyBudget}/day`
                            : "—";
                          return (
                            <tr key={ad.id} className="border-b border-border/60">
                              <td className="py-3 pr-3 font-medium">{ad.name}</td>
                              <td className="py-3 pr-3">{adset?.name ?? "—"}</td>
                              <td className="py-3 pr-3">{campaign?.name ?? "—"}</td>
                              <td className="py-3 pr-3">{account?.name ?? "—"}</td>
                              <td className="py-3 pr-3">{budget}</td>
                              <td className="py-3">
                                <StatusBadge
                                  active={(ad.status ?? "").toUpperCase() === "ACTIVE"}
                                  label={ad.status ?? "—"}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : null}
            </CardContent>
          </Card>

          {(businesses.data?.length ?? 0) > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Business Managers</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {!assetsLoading && !connected ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Link2Off className="h-4 w-4" />
            Connect Meta to import ad accounts, pages, and lead forms.
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={Boolean(mappingForm)} onOpenChange={(open) => !open && setMappingForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Lead Assignment</DialogTitle>
            <DialogDescription>
              {mappingForm
                ? `${mappingForm.name} · ${pageNameById.get(mappingForm.pageId) ?? "Page"}`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Project</span>
              <select
                value={mappingProjectId}
                onChange={(e) => setMappingProjectId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">No project</option>
                {(projects.data ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="space-y-2 text-sm">
              <legend className="font-medium">Assignment basis</legend>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="assignment-basis"
                  checked={mappingStrategy === "round_robin"}
                  onChange={() => setMappingStrategy("round_robin")}
                  className="h-4 w-4"
                />
                <span>
                  Sequential (round-robin)
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Rotate leads across selected users in order
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="assignment-basis"
                  checked={mappingStrategy === "first"}
                  onChange={() => setMappingStrategy("first")}
                  className="h-4 w-4"
                />
                <span>
                  Always first user
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Every lead goes to the first selected user
                  </span>
                </span>
              </label>
            </fieldset>

            <fieldset className="space-y-2 text-sm">
              <legend className="font-medium">Assignment type</legend>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="assignment-type"
                  checked={mappingAssigneeMode === "selected"}
                  onChange={() => selectSpecificAssignees()}
                  className="h-4 w-4"
                />
                <span>Select users</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="assignment-type"
                  checked={mappingAssigneeMode === "all"}
                  onChange={() => selectAllAssignees()}
                  className="h-4 w-4"
                />
                <span>
                  All users
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Round-robin across every agent and manager ({allAssignableIds.length})
                  </span>
                </span>
              </label>
            </fieldset>

            {mappingAssigneeMode === "selected" ? (
              <div className="space-y-1.5 text-sm">
                <span className="font-medium">Select user(s)</span>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {(assignableUsers.data ?? []).length === 0 ? (
                    <p className="px-1 py-2 text-xs text-muted-foreground">
                      No agents/managers found.
                    </p>
                  ) : (
                    (assignableUsers.data ?? []).map((user) => {
                      const checked = mappingAssigneeIds.includes(user.id);
                      return (
                        <label
                          key={user.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMappingAssignee(user.id)}
                            className="h-4 w-4 rounded border-input"
                          />
                          <span className="text-sm">
                            {user.name}{" "}
                            <span className="text-xs capitalize text-muted-foreground">
                              ({user.role})
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                New Meta leads from this form will rotate across all agents and managers.
              </p>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={busy || !mappingForm}
              onClick={() => void clearFormAssignment()}
            >
              Clear assignees
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setMappingForm(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={busy || !mappingForm}
                onClick={() => void saveFormAssignment()}
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MetaSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-6">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        </div>
      }
    >
      <MetaDashboardInner />
    </Suspense>
  );
}
