"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";
import { useSyncWhatsAppTemplates, useWhatsAppTemplates } from "@/hooks/use-whatsapp";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { MessageCircle, RefreshCw } from "lucide-react";
import Link from "next/link";

function categoryLabel(category: string) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default function WhatsAppSettingsPage() {
  const { ready, hasPermission, isAdmin } = usePermissions();
  const canView = hasPermission("org_profile:view");
  const templates = useWhatsAppTemplates({ all: true, enabled: ready && canView && isAdmin });
  const sync = useSyncWhatsAppTemplates();

  if (ready && !canView) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Template messaging configuration.</p>
        </div>
        <AccessDeniedEmptyState />
      </div>
    );
  }

  if (ready && !isAdmin) {
    return (
      <div className="space-y-4">
        <div>
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/settings" className="hover:text-foreground hover:underline">
              Settings
            </Link>
            <span className="mx-2 text-muted-foreground/70">/</span>
            <span className="text-foreground">WhatsApp</span>
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">WhatsApp</h1>
        </div>
        <AccessDeniedEmptyState description="Only admins can manage WhatsApp templates." />
      </div>
    );
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
            <span className="text-foreground">WhatsApp</span>
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">WhatsApp templates</h1>
          <p className="text-sm text-muted-foreground">
            Approved Meta templates used for outbound property updates and follow-ups.
          </p>
        </div>
        <Button type="button" onClick={() => sync.mutate()} disabled={sync.isPending}>
          <RefreshCw className={cn("mr-2 h-4 w-4", sync.isPending && "animate-spin")} />
          Sync from Meta
        </Button>
      </div>

      <Card className="">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-emerald-600" />
            Message templates
          </CardTitle>
          <CardDescription>
            Requires WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID on the API server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading templates...</p>
          ) : templates.isError ? (
            <p className="text-sm text-destructive">Unable to load templates.</p>
          ) : (templates.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              No templates yet. Click &quot;Sync from Meta&quot; after your WABA templates are
              approved.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-white/10">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Variables</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.data?.items.map((template) => (
                    <tr key={template.id} className="border-t border-black">
                      <td className="px-4 py-3">
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-muted-foreground">{template.templateName}</div>
                      </td>
                      <td className="px-4 py-3">{categoryLabel(template.category)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {template.variables.length > 0 ? template.variables.join(", ") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={template.isActive ? "default" : "secondary"}>
                          {template.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
