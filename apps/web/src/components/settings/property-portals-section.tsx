"use client";

import { ProjectAvailabilitySwitch } from "@/components/projects/project-availability-switch";
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
  type PortalFieldMapping,
  type PortalName,
  type PortalWebhook,
  useCreatePortalWebhook,
  usePortalWebhooks,
  useTestPortalWebhookById,
  useTestPortalWebhookPreview,
  useUpdatePortalWebhook,
} from "@/hooks/use-portal-webhooks";
import { useSession } from "@/hooks/use-session";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { Building2, Check, Copy, Plus, TestTube2 } from "lucide-react";
import { useMemo, useState } from "react";

const PORTAL_OPTIONS: { value: PortalName; label: string }[] = [
  { value: "99acres", label: "99acres" },
  { value: "magicbricks", label: "MagicBricks" },
  { value: "housing", label: "Housing.com" },
  { value: "indiamrt", label: "IndiaMART" },
  { value: "other", label: "Other" },
];

const DEFAULT_MAPPINGS: Record<PortalName, PortalFieldMapping> = {
  "99acres": {
    name: "sender_name",
    phone: "sender_phone",
    email: "sender_email",
    message: "message",
    projectInterest: "property_name",
  },
  magicbricks: {
    name: "Name",
    phone: "Mobile",
    email: "Email",
    message: "Message",
    projectInterest: "Project",
  },
  housing: {
    name: "name",
    phone: "phone",
    email: "email",
    message: "remarks",
    projectInterest: "project_name",
  },
  indiamrt: {
    name: "SENDERNAME",
    phone: "MOB",
    email: "SENDEREMAIL",
    message: "Query",
    projectInterest: "GLUSR_USR_PRODUCT_NAME",
  },
  other: {
    name: "name",
    phone: "phone",
    email: "email",
    message: "message",
    projectInterest: "project",
  },
};

const MOCK_PAYLOADS: Record<PortalName, Record<string, string>> = {
  "99acres": {
    sender_name: "Rahul Sharma",
    sender_phone: "9876543210",
    sender_email: "rahul@example.com",
    message: "Interested in 3BHK",
    property_name: "Sunrise Heights",
  },
  magicbricks: {
    Name: "Priya Patel",
    Mobile: "8765432109",
    Email: "priya@example.com",
    Message: "Please call back",
    Project: "Green Valley",
  },
  housing: {
    name: "Amit Kumar",
    phone: "7654321098",
    email: "amit@example.com",
    remarks: "Site visit requested",
    project_name: "Lake View Residency",
  },
  indiamrt: {
    SENDERNAME: "Neha Singh",
    MOB: "9123456789",
    SENDEREMAIL: "neha@example.com",
    Query: "Need pricing details",
    GLUSR_USR_PRODUCT_NAME: "Commercial Plot",
  },
  other: {
    name: "Test Lead",
    phone: "9988776655",
    email: "test@example.com",
    message: "General inquiry",
    project: "Demo Project",
  },
};

function portalLabel(portalName: PortalName) {
  return PORTAL_OPTIONS.find((option) => option.value === portalName)?.label ?? portalName;
}

function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
      {copied ? "Copied" : "Copy URL"}
    </Button>
  );
}

function PortalWebhookRow({ webhook }: { webhook: PortalWebhook }) {
  const updateMutation = useUpdatePortalWebhook();
  const testMutation = useTestPortalWebhookById();
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <div className="border-2 border-black p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{portalLabel(webhook.portalName)}</p>
              <Badge variant={webhook.isActive ? "default" : "secondary"}>
                {webhook.isActive ? "Active" : "Paused"}
              </Badge>
            </div>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {webhook.webhookUrl}
            </p>
            <p className="text-sm text-muted-foreground">
              Last lead:{" "}
              {webhook.lastLeadReceivedAt
                ? new Date(webhook.lastLeadReceivedAt).toLocaleString()
                : "Never"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CopyUrlButton url={webhook.webhookUrl} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testMutation.isPending}
              onClick={() => {
                testMutation.mutate(webhook.id, {
                  onSuccess: () => setPreviewOpen(true),
                });
              }}
            >
              <TestTube2 className="mr-2 h-4 w-4" />
              Test Webhook
            </Button>
            <div className="flex items-center gap-2 border-2 border-black px-3 py-2">
              <Label htmlFor={`portal-active-${webhook.id}`} className="text-sm">
                Active
              </Label>
              <ProjectAvailabilitySwitch
                checked={webhook.isActive}
                disabled={updateMutation.isPending}
                label={`Toggle ${portalLabel(webhook.portalName)} webhook`}
                onCheckedChange={(checked) => {
                  updateMutation.mutate({ id: webhook.id, isActive: checked });
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook test preview</DialogTitle>
            <DialogDescription>
              Mapped lead preview from mock {portalLabel(webhook.portalName)} payload (not saved).
            </DialogDescription>
          </DialogHeader>
          {testMutation.data?.preview ? (
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd>
                  {testMutation.data.preview.firstName} {testMutation.data.preview.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{testMutation.data.preview.phone}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{testMutation.data.preview.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Project</dt>
                <dd>{testMutation.data.preview.projectName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Notes</dt>
                <dd>{testMutation.data.preview.notes ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Source</dt>
                <dd>{testMutation.data.preview.leadSource}</dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter>
            <Button type="button" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PropertyPortalsSection() {
  const { isAdmin } = useSession();
  const webhooksQuery = usePortalWebhooks(isAdmin);
  const createMutation = useCreatePortalWebhook();
  const previewMutation = useTestPortalWebhookPreview();

  const [addOpen, setAddOpen] = useState(false);
  const [portalName, setPortalName] = useState<PortalName>("99acres");
  const [mappingJson, setMappingJson] = useState(() =>
    JSON.stringify(DEFAULT_MAPPINGS["99acres"], null, 2),
  );
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const parsedMapping = useMemo(() => {
    try {
      const parsed = JSON.parse(mappingJson) as PortalFieldMapping;
      if (!parsed.name || !parsed.phone) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [mappingJson]);

  if (!isAdmin) {
    return null;
  }

  return (
    <Card className="">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-orange-600" />
            Property Portals
          </CardTitle>
          <CardDescription>
            Inbound webhooks for 99acres, MagicBricks, Housing.com, and IndiaMART leads.
          </CardDescription>
        </div>
        <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Portal
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {webhooksQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading portal webhooks...</p>
        ) : webhooksQuery.isError ? (
          <p className="text-sm text-destructive">Unable to load portal webhooks.</p>
        ) : webhooksQuery.data?.length ? (
          webhooksQuery.data.map((webhook) => (
            <PortalWebhookRow key={webhook.id} webhook={webhook} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No portal webhooks configured. Add a portal to generate a webhook URL.
          </p>
        )}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add property portal</DialogTitle>
            <DialogDescription>
              Choose a portal and customize field mapping. The webhook URL is generated after save.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="portal-name">Portal</Label>
              <select
                id="portal-name"
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                value={portalName}
                onChange={(event) => {
                  const next = event.target.value as PortalName;
                  setPortalName(next);
                  setMappingJson(JSON.stringify(DEFAULT_MAPPINGS[next], null, 2));
                  setMappingError(null);
                }}
              >
                {PORTAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-mapping">Field mapping (JSON)</Label>
              <textarea
                id="field-mapping"
                className={cn(
                  "min-h-[180px] w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-xs",
                  mappingError && "border-destructive",
                )}
                value={mappingJson}
                onChange={(event) => {
                  setMappingJson(event.target.value);
                  setMappingError(null);
                }}
              />
              {mappingError ? <p className="text-sm text-destructive">{mappingError}</p> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!parsedMapping || previewMutation.isPending}
                onClick={() => {
                  if (!parsedMapping) {
                    setMappingError("Mapping must include name and phone keys.");
                    return;
                  }
                  previewMutation.mutate(
                    {
                      portalName,
                      fieldMapping: parsedMapping,
                      payload: MOCK_PAYLOADS[portalName],
                    },
                    { onSuccess: () => setPreviewOpen(true) },
                  );
                }}
              >
                <TestTube2 className="mr-2 h-4 w-4" />
                Test mapping
              </Button>
            </div>

            {previewMutation.data?.preview ? (
              <div className="border-2 border-black bg-muted/30 p-3 text-sm">
                <p className="mb-2 font-medium">Mapped preview</p>
                <p>
                  {previewMutation.data.preview.firstName} {previewMutation.data.preview.lastName} ·{" "}
                  {previewMutation.data.preview.phone}
                </p>
                <p className="text-muted-foreground">
                  {previewMutation.data.preview.projectName ?? "No project"} ·{" "}
                  {previewMutation.data.preview.leadSource}
                </p>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => {
                let fieldMapping: PortalFieldMapping;
                try {
                  fieldMapping = JSON.parse(mappingJson) as PortalFieldMapping;
                  if (!fieldMapping.name || !fieldMapping.phone) {
                    throw new Error("name and phone are required");
                  }
                } catch {
                  setMappingError("Invalid JSON mapping. Include at least name and phone.");
                  return;
                }

                createMutation.mutate(
                  { portalName, fieldMapping },
                  {
                    onSuccess: () => {
                      setAddOpen(false);
                      setPreviewOpen(false);
                    },
                  },
                );
              }}
            >
              Create webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mapping preview</DialogTitle>
            <DialogDescription>
              Lead fields after applying your mapping (not saved).
            </DialogDescription>
          </DialogHeader>
          {previewMutation.data?.preview ? (
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd>
                  {previewMutation.data.preview.firstName} {previewMutation.data.preview.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{previewMutation.data.preview.phone}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Project</dt>
                <dd>{previewMutation.data.preview.projectName ?? "—"}</dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
