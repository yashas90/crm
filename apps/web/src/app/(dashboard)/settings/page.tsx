"use client";

import { useSession } from "@/hooks/use-session";
import { apiGet } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plug } from "lucide-react";
import Link from "next/link";

type OrgRecord = {
  id: string;
  name: string;
  slug: string;
  subscriptionTier: string;
  settings: Record<string, unknown>;
  createdAt: string;
};

export default function SettingsPage() {
  const { session, ready, isAdmin } = useSession();
  const org = useQuery({
    queryKey: ["org"],
    queryFn: () => apiGet<OrgRecord>("/api/org"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Organization and account preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Signed-in user from your JWT session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Name:</span>{" "}
            {ready ? (session?.name ?? "—") : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Email:</span>{" "}
            {ready ? (session?.email ?? "—") : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Role:</span>{" "}
            {ready ? (session?.role ?? "—") : "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
          <CardDescription>Read-only org profile from the API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {org.isLoading ? (
            <p className="text-muted-foreground">Loading organization...</p>
          ) : org.isError || !org.data ? (
            <p className="text-muted-foreground">Unable to load organization.</p>
          ) : (
            <>
              <p>
                <span className="text-muted-foreground">Name:</span> {org.data.name}
              </p>
              <p>
                <span className="text-muted-foreground">Slug:</span> {org.data.slug}
              </p>
              <p>
                <span className="text-muted-foreground">Plan:</span> {org.data.subscriptionTier}
              </p>
              <p>
                <span className="text-muted-foreground">Created:</span>{" "}
                {new Date(org.data.createdAt).toLocaleString()}
              </p>
              {Object.keys(org.data.settings ?? {}).length > 0 ? (
                <pre className="mt-2 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
                  {JSON.stringify(org.data.settings, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground">No custom settings configured.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {ready && isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audit log</CardTitle>
            <CardDescription>Who changed users, leads, projects, and TCF consent.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/audit-log">
                <ClipboardList className="mr-2 h-4 w-4" />
                View audit log
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
          <CardDescription>Ad platform lead ingestion status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            View whether Facebook Lead Ads and Google Ads are configured on the API server.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/integrations">
              <Plug className="mr-2 h-4 w-4" />
              Manage integrations
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demo data</CardTitle>
          <CardDescription>Seed data is managed outside the web UI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            To reset demo leads and calls, run the database seed from your development environment.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info("Contact admin to reset demo data.")}
          >
            Refresh seed data
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Web policy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This web application is for data viewing and management only. Outbound calling is
            handled exclusively by the mobile app via SIM.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
