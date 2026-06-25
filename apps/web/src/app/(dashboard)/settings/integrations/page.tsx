"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { PropertyPortalsSection } from "@/components/settings/property-portals-section";
import { Badge } from "@/components/ui/badge";
import { useIntegrationsStatus } from "@/hooks/use-integrations-status";
import { usePermissions } from "@/hooks/use-permissions";
import { useSession } from "@/hooks/use-session";
import { apiDelete, apiGet, apiPost } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Megaphone, RefreshCw } from "lucide-react";
import Link from "next/link";

function StatusBadge({ status }: { status: "live" | "not_configured" | undefined }) {
  const live = status === "live";
  return (
    <Badge
      variant={live ? "default" : "secondary"}
      className={cn(!live && "text-muted-foreground")}
    >
      {live ? "Live" : "Not configured"}
    </Badge>
  );
}

function IntegrationMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}:</span> {value}
    </p>
  );
}

type GCalStatus = { connected: boolean; calendarId: string | null; connectedAt: string | null };
type GCalConnectData = { url: string };

function GoogleCalendarSection() {
  const { session } = useSession();
  const qc = useQueryClient();

  const status = useQuery({
    queryKey: ["gcal-status"],
    queryFn: () => apiGet<GCalStatus>("/api/google-calendar/status"),
  });

  const connect = useMutation({
    mutationFn: () => apiGet<GCalConnectData>("/api/google-calendar/connect"),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to start Google auth")),
  });

  const disconnect = useMutation({
    mutationFn: () => apiDelete("/api/google-calendar/disconnect"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gcal-status"] });
      toast.success("Google Calendar disconnected");
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to disconnect")),
  });

  const gcal = status.data;

  return (
    <Card className="overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-green-500 to-emerald-600" />
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-emerald-600" />
            Google Calendar
          </CardTitle>
          <CardDescription>Sync site visits to your Google Calendar.</CardDescription>
        </div>
        <Badge variant={gcal?.connected ? "default" : "secondary"}>
          {gcal?.connected ? "Connected" : "Not connected"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {gcal?.connected ? (
          <>
            <p className="text-muted-foreground">
              Connected as <strong>{session?.email}</strong>
              {gcal.connectedAt
                ? ` · since ${new Date(gcal.connectedAt).toLocaleDateString()}`
                : ""}
            </p>
            <p className="text-muted-foreground">
              Calendar: <span className="font-mono">{gcal.calendarId ?? "primary"}</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              Connect your Google account to push site visit events to Google Calendar. Requires
              GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the API server.
            </p>
            <Button size="sm" onClick={() => connect.mutate()} disabled={connect.isPending}>
              {connect.isPending ? "Redirecting…" : "Connect Google Calendar"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function IntegrationsSettingsPage() {
  const { ready, hasPermission } = usePermissions();
  const canView = hasPermission("org_profile:view");
  const statusQuery = useIntegrationsStatus({ enabled: ready && canView });

  if (ready && !canView) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-sm text-muted-foreground">Ad platform connection status.</p>
        </div>
        <AccessDeniedEmptyState />
      </div>
    );
  }

  const status = statusQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/settings" className="hover:text-foreground hover:underline">
              Settings
            </Link>
            <span className="mx-2 text-muted-foreground/70">/</span>
            <span className="text-foreground">Integrations</span>
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Ad platform status and property portal webhook configuration.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={statusQuery.isFetching}
          onClick={() => void statusQuery.refetch()}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", statusQuery.isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <PropertyPortalsSection />

      {statusQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading integration status...</p>
      ) : statusQuery.isError ? (
        <p className="text-sm text-destructive">Unable to load integration status.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-blue-600" />
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Megaphone className="h-4 w-4 text-blue-600" />
                  Meta Lead Ads
                </CardTitle>
                <CardDescription>
                  Webhook ingestion from Meta Lead Ads (Facebook / Instagram).
                </CardDescription>
              </div>
              <StatusBadge status={status?.facebook.status} />
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <IntegrationMetaRow
                label="Page ID"
                value={status?.facebook.pageId ?? "Not set in server config"}
              />
              <div>
                <p className="text-muted-foreground">Form IDs</p>
                {status?.facebook.formIds?.length ? (
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {status.facebook.formIds.map((formId) => (
                      <li key={formId} className="font-mono text-xs">
                        {formId}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm">Not set in server config</p>
                )}
              </div>
              <IntegrationMetaRow
                label="Webhook signature"
                value={
                  status?.facebook.webhookSignatureConfigured
                    ? "Enabled (META_APP_SECRET set)"
                    : "Not enabled — set META_APP_SECRET in production"
                }
              />
              <IntegrationMetaRow
                label="Page scoping"
                value={
                  status?.facebook.pageScopingEnabled
                    ? "Active — only configured Page ID is ingested"
                    : "Off — all subscribed pages are ingested"
                }
              />
              <IntegrationMetaRow
                label="Form scoping"
                value={
                  status?.facebook.formScopingEnabled
                    ? "Active — only listed form IDs are ingested"
                    : "Off — all forms on subscribed pages are ingested"
                }
              />
              <p className="pt-2 text-xs text-muted-foreground">
                Requires PAGE_ACCESS_TOKEN, META_VERIFY_TOKEN, and META_APP_SECRET on the API
                server. Leads arrive via POST /api/integrations/meta/webhook.
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-emerald-600" />
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Megaphone className="h-4 w-4 text-emerald-600" />
                  Google Ads
                </CardTitle>
                <CardDescription>Scheduled polling of lead form submissions.</CardDescription>
              </div>
              <StatusBadge status={status?.googleAds.status} />
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <IntegrationMetaRow
                label="Customer ID"
                value={status?.googleAds.customerId ?? "Not set in server config"}
              />
              <IntegrationMetaRow
                label="Sync job"
                value={
                  status?.googleAds.syncEnabled
                    ? "Enabled (polling active)"
                    : status?.googleAds.enabled
                      ? "Disabled — set GOOGLE_ADS_SYNC_ENABLED=true"
                      : "Unavailable until credentials are configured"
                }
              />
              <IntegrationMetaRow
                label="Last sync"
                value={
                  status?.googleAds.lastSyncAt
                    ? new Date(status.googleAds.lastSyncAt).toLocaleString()
                    : "Not run yet"
                }
              />
              {status?.googleAds.lastSyncError ? (
                <p className="text-sm text-destructive">
                  Last error: {status.googleAds.lastSyncError}
                </p>
              ) : null}
              <p className="pt-2 text-xs text-muted-foreground">
                Requires Google Ads OAuth credentials and developer token on the API server.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <GoogleCalendarSection />
    </div>
  );
}
