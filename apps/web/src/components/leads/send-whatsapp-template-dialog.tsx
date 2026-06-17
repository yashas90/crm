"use client";

import type { LeadDetail } from "@/hooks/use-leads";
import {
  buildDefaultTemplateVariables,
  useSendWhatsAppMessage,
  useWhatsAppTemplates,
  variableKeyFromPlaceholder,
} from "@/hooks/use-whatsapp";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useEffect, useMemo, useState } from "react";

type SendWhatsAppTemplateDialogProps = {
  lead: LeadDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SendWhatsAppTemplateDialog({
  lead,
  open,
  onOpenChange,
}: SendWhatsAppTemplateDialogProps) {
  const templates = useWhatsAppTemplates({ enabled: open });
  const send = useSendWhatsAppMessage();
  const [templateId, setTemplateId] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});

  const selectedTemplate = useMemo(
    () => templates.data?.items.find((item) => item.id === templateId),
    [templates.data?.items, templateId],
  );

  useEffect(() => {
    if (!open) return;
    const defaults = buildDefaultTemplateVariables(lead);
    setVariables(defaults);
    const first = templates.data?.items[0];
    if (first) setTemplateId(first.id);
  }, [open, lead, templates.data?.items]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const defaults = buildDefaultTemplateVariables(lead);
    const next: Record<string, string> = { ...defaults };
    for (const placeholder of selectedTemplate.variables) {
      const key = variableKeyFromPlaceholder(placeholder);
      next[key] = defaults[key as keyof typeof defaults] ?? variables[key] ?? "";
    }
    setVariables(next);
  }, [selectedTemplate, lead]);

  if (!open) return null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!templateId) return;

    send.mutate(
      { leadId: lead.id, templateId, variables },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold">Send WhatsApp template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sends an approved Meta template to {lead.firstName} {lead.lastName}
          {lead.phone ? ` (${lead.phone})` : ""}.
        </p>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wa-template">Template</Label>
            <select
              id="wa-template"
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              required
            >
              {(templates.data?.items ?? []).map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.category})
                </option>
              ))}
            </select>
            {templates.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading templates...</p>
            ) : null}
            {!templates.isLoading && (templates.data?.items.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">
                No active templates. Ask an admin to sync templates in Settings → WhatsApp.
              </p>
            ) : null}
          </div>

          {selectedTemplate?.variables.map((placeholder) => {
            const key = variableKeyFromPlaceholder(placeholder);
            return (
              <div key={placeholder} className="space-y-2">
                <Label htmlFor={`wa-var-${key}`}>{placeholder}</Label>
                <Input
                  id={`wa-var-${key}`}
                  value={variables[key] ?? ""}
                  onChange={(event) =>
                    setVariables((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={send.isPending || !templateId || !lead.phone}>
            {send.isPending ? "Sending..." : "Send template"}
          </Button>
        </div>
      </form>
    </div>
  );
}
