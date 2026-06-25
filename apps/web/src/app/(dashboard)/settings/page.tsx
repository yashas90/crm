"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { useSession } from "@/hooks/use-session";
import { ApiRequestError, apiGet, apiPatch } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plug } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type OrgRecord = {
  id: string;
  name: string;
  slug: string;
  subscriptionTier: string;
  settings: Record<string, unknown>;
  createdAt: string;
};

function readSetting(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  return typeof value === "string" ? value : "";
}

export default function SettingsPage() {
  const { session, ready, isAdmin } = useSession();
  const { hasPermission } = usePermissions();
  const canUpdateOrg = hasPermission("org_profile:update");
  const queryClient = useQueryClient();

  const org = useQuery({
    queryKey: ["org"],
    queryFn: () => apiGet<OrgRecord>("/api/org"),
  });

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    if (!org.data) return;
    setName(org.data.name);
    setWebsite(readSetting(org.data.settings ?? {}, "website"));
    setTimezone(readSetting(org.data.settings ?? {}, "timezone"));
  }, [org.data]);

  const saveOrg = useMutation({
    mutationFn: (body: { name: string; website: string; timezone: string }) =>
      apiPatch<OrgRecord>("/api/org", {
        name: body.name.trim(),
        website: body.website.trim() || null,
        timezone: body.timezone.trim() || null,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["org"], data);
      toast.success("Organization settings saved.");
    },
    onError: (error) => {
      const message =
        error instanceof ApiRequestError ? error.message : "Failed to update organization.";
      toast.error(message);
    },
  });

  function handleOrgSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUpdateOrg) return;
    saveOrg.mutate({ name, website, timezone });
  }

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
          <CardDescription>
            {canUpdateOrg
              ? "Update your organization profile and defaults."
              : "Organization profile (read-only)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {org.isLoading ? (
            <p className="text-muted-foreground">Loading organization...</p>
          ) : org.isError || !org.data ? (
            <p className="text-muted-foreground">Unable to load organization.</p>
          ) : canUpdateOrg ? (
            <form className="space-y-4" onSubmit={handleOrgSubmit}>
              <div className="space-y-2">
                <Label htmlFor="org-name">Name</Label>
                <Input
                  id="org-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-website">Website</Label>
                <Input
                  id="org-website"
                  type="url"
                  placeholder="https://example.com"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-timezone">Timezone</Label>
                <Input
                  id="org-timezone"
                  placeholder="Asia/Kolkata"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">IANA timezone, e.g. Asia/Kolkata.</p>
              </div>

              <div className="grid gap-2 rounded-lg border border-slate-200/80 bg-muted/20 p-3 text-sm dark:border-white/10">
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
              </div>

              <Button type="submit" disabled={saveOrg.isPending}>
                {saveOrg.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          ) : (
            <>
              <p>
                <span className="text-muted-foreground">Name:</span> {org.data.name}
              </p>
              <p>
                <span className="text-muted-foreground">Website:</span>{" "}
                {readSetting(org.data.settings ?? {}, "website") || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Timezone:</span>{" "}
                {readSetting(org.data.settings ?? {}, "timezone") || "—"}
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
            </>
          )}
        </CardContent>
      </Card>

      {ready && (isAdmin || session?.role === "manager") ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Targets</CardTitle>
            <CardDescription>Set monthly call, visit, and booking goals per agent.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/agent-targets">Manage agent targets</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {ready && (isAdmin || session?.role === "manager") ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assignment Rules</CardTitle>
            <CardDescription>Auto-assign new leads by source, city, or area.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/assignment-rules">Manage assignment rules</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {ready && isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline Stages</CardTitle>
            <CardDescription>Customize your pipeline board columns and colors.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/pipeline-stages">Manage pipeline stages</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {ready && (isAdmin || session?.role === "manager") ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Message templates</CardTitle>
            <CardDescription>
              WhatsApp message presets for agents (client-side wa.me links, not Meta API).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/message-templates">Manage message templates</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

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
