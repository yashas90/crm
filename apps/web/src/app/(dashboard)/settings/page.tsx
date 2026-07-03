"use client";

import { LeadScoringSettingsCard } from "@/components/settings/lead-scoring-settings-card";
import { OrgProfileSettingsCard } from "@/components/settings/org-profile-settings-card";
import { OrgRegionalSettingsCard } from "@/components/settings/org-regional-settings-card";
import { ReportEmailsSettingsCard } from "@/components/settings/report-emails-settings-card";
import { SiteVisitReminderSettingsCard } from "@/components/settings/site-visit-reminder-settings-card";
import { useOrg } from "@/hooks/use-org";
import { usePermissions } from "@/hooks/use-permissions";
import { useSession } from "@/hooks/use-session";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plug, Shield } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { session, ready, isAdmin } = useSession();
  const { hasPermission } = usePermissions();
  const canUpdateOrg = hasPermission("org_profile:update");
  const queryClient = useQueryClient();
  const org = useOrg();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Organization and account preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>
            Signed-in user profile (JWT in HttpOnly cookie on API domain).
          </CardDescription>
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

      {org.isError ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">Unable to load organization settings.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <OrgProfileSettingsCard org={org.data} canUpdate={canUpdateOrg} />
          <OrgRegionalSettingsCard org={org.data} canUpdate={canUpdateOrg} />
          <SiteVisitReminderSettingsCard org={org.data} canUpdate={canUpdateOrg} />
        </>
      )}

      {ready && (isAdmin || session?.role === "manager") ? (
        <ReportEmailsSettingsCard
          org={org.data}
          canUpdate={canUpdateOrg}
          isAdmin={isAdmin}
          queryClient={queryClient}
        />
      ) : null}

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

      <LeadScoringSettingsCard org={org.data} canUpdate={canUpdateOrg} queryClient={queryClient} />

      {ready && isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security</CardTitle>
            <CardDescription>
              Failed logins, export monitoring, and active sessions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/security">
                <Shield className="mr-2 h-4 w-4" />
                Security dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {ready && (isAdmin || session?.role === "manager") ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Booking management</CardTitle>
            <CardDescription>
              Reserve and book inventory units; link leads to units and generate booking PDFs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/projects">Manage project inventory</Link>
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

      {ready && isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">WhatsApp templates</CardTitle>
            <CardDescription>Meta Business API template sync and approval status.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/whatsapp">Manage WhatsApp templates</Link>
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
