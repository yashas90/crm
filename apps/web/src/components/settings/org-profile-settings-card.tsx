"use client";

import { type OrgRecord, orgPatchErrorMessage, useUpdateOrg } from "@/hooks/use-org";
import { readOrgStringSetting } from "@/lib/org-settings";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useEffect, useState } from "react";

type OrgProfileSettingsCardProps = {
  org?: OrgRecord;
  canUpdate: boolean;
};

export function OrgProfileSettingsCard({ org, canUpdate }: OrgProfileSettingsCardProps) {
  const updateOrg = useUpdateOrg();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    if (!org) return;
    setName(org.name);
    setWebsite(readOrgStringSetting(org.settings ?? {}, "website"));
  }, [org]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUpdate) return;
    updateOrg.mutate(
      {
        name: name.trim(),
        website: website.trim() || null,
      },
      {
        onSuccess: () => toast.success("Organization profile saved."),
        onError: (error) =>
          toast.error(orgPatchErrorMessage(error, "Failed to update organization.")),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Organization</CardTitle>
        <CardDescription>
          {canUpdate
            ? "Update your organization name and public website."
            : "Organization profile (read-only)."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {org ? (
          canUpdate ? (
            <form className="space-y-4" onSubmit={handleSubmit}>
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

              <OrgMetaReadonly org={org} />

              <Button type="submit" disabled={updateOrg.isPending}>
                {updateOrg.isPending ? "Saving..." : "Save profile"}
              </Button>
            </form>
          ) : (
            <>
              <p>
                <span className="text-muted-foreground">Name:</span> {org.name}
              </p>
              <p>
                <span className="text-muted-foreground">Website:</span>{" "}
                {readOrgStringSetting(org.settings ?? {}, "website") || "—"}
              </p>
              <OrgMetaReadonly org={org} />
            </>
          )
        ) : (
          <p className="text-muted-foreground">Loading organization...</p>
        )}
      </CardContent>
    </Card>
  );
}

function OrgMetaReadonly({ org }: { org: OrgRecord }) {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200/80 bg-muted/20 p-3 text-sm dark:border-white/10">
      <p>
        <span className="text-muted-foreground">Slug:</span> {org.slug}
      </p>
      <p>
        <span className="text-muted-foreground">Created:</span>{" "}
        {new Date(org.createdAt).toLocaleString()}
      </p>
    </div>
  );
}
