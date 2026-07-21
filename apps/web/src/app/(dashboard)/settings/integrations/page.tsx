"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { GoogleCalendarSettingsCard } from "@/components/settings/google-calendar-settings-card";
import { PropertyPortalsSection } from "@/components/settings/property-portals-section";
import { Badge } from "@/components/ui/badge";
import {
  type IntegrationConnectionStatus,
  useIntegrationsStatus,
} from "@/hooks/use-integrations-status";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { Megaphone, RefreshCw } from "lucide-react";
import Link from "next/link";

function StatusBadge({ status }: { status: IntegrationConnectionStatus | undefined }) {
  if (status === "live") {
    return <Badge variant="default">Live</Badge>;
  }
  if (status === "ready") {
    return <Badge variant="outline">Ready to connect</Badge>;
  }
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      Not configured
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
  const facebook = status?.facebook;

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

      <GoogleCalendarSettingsCard />

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
                  Multi-page OAuth + webhook ingest (Facebook / Instagram Lead Ads).
                </CardDescription>
              </div>
              <StatusBadge status={facebook?.status} />
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <IntegrationMetaRow
                label="OAuth"
                value={facebook?.oauthConnected ? "Connected" : "Not connected — click Manage Meta"}
              />
              <IntegrationMetaRow label="Active pages" value={String(facebook?.activePages ?? 0)} />
              <IntegrationMetaRow label="Active forms" value={String(facebook?.activeForms ?? 0)} />
              <IntegrationMetaRow
                label="Leadgen subscribed"
                value={String(facebook?.leadgenSubscribedPages ?? 0)}
              />
              <IntegrationMetaRow
                label="Verify token"
                value={
                  facebook?.verifyTokenConfigured
                    ? "Set (META_VERIFY_TOKEN)"
                    : "Missing — set META_VERIFY_TOKEN on Railway"
                }
              />
              <IntegrationMetaRow
                label="Webhook signature"
                value={
                  facebook?.webhookSignatureConfigured
                    ? "Enabled (META_APP_SECRET set)"
                    : "Not enabled — set META_APP_SECRET on Railway"
                }
              />
              <p className="pt-2 text-xs text-muted-foreground">
                No page IDs or page tokens in env. Connect Meta, then Sync Now. Webhook:{" "}
                <span className="font-mono">POST /api/integrations/meta/webhook</span>
              </p>
              <Button asChild size="sm" className="mt-2">
                <Link href="/settings/integrations/meta">
                  {facebook?.oauthConnected ? "Manage Meta" : "Connect Meta"}
                </Link>
              </Button>
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
    </div>
  );
}
