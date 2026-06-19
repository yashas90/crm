"use client";

import type { LeadLinkedUnit } from "@/hooks/use-message-templates";
import type { MessageTemplate } from "@/hooks/use-message-templates";
import {
  type MessageTemplateVariables,
  buildWhatsAppUrl,
  substituteMessageTemplate,
} from "@propninja/types/message-templates";
import { Button } from "@propninja/ui/button";
import { useMemo, useState } from "react";

type WhatsAppMessagePickerDialogProps = {
  open: boolean;
  phone: string;
  leadName: string;
  agentName: string;
  projectName?: string | null;
  linkedUnit?: LeadLinkedUnit | null;
  templates: MessageTemplate[];
  isLoading?: boolean;
  onOpenChange: (open: boolean) => void;
};

export function buildMessageTemplateVariables(input: {
  leadName: string;
  agentName: string;
  projectName?: string | null;
  linkedUnit?: LeadLinkedUnit | null;
}): MessageTemplateVariables {
  return {
    leadName: input.leadName,
    agentName: input.agentName,
    projectName: input.linkedUnit?.projectName ?? input.projectName ?? undefined,
    unitNumber: input.linkedUnit?.unitNumber,
    priceListedRs: input.linkedUnit?.priceListedRs,
  };
}

export function WhatsAppMessagePickerDialog({
  open,
  phone,
  leadName,
  agentName,
  projectName,
  linkedUnit,
  templates,
  isLoading,
  onOpenChange,
}: WhatsAppMessagePickerDialogProps) {
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const vars = useMemo(
    () =>
      buildMessageTemplateVariables({
        leadName,
        agentName,
        projectName,
        linkedUnit,
      }),
    [leadName, agentName, projectName, linkedUnit],
  );

  const selectedTemplate = templates.find((item) => item.id === selectedId) ?? templates[0];

  const previewMessage = customMode
    ? customText
    : selectedTemplate
      ? substituteMessageTemplate(selectedTemplate.content, vars)
      : "";

  if (!open) return null;

  function handleOpenWhatsApp() {
    const message = customMode ? customText.trim() : previewMessage.trim();
    if (!message) return;
    const url = buildWhatsAppUrl(phone, message);
    window.open(url, "_blank", "noopener,noreferrer");
    onOpenChange(false);
    setCustomMode(false);
    setCustomText("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-background shadow-xl">
        <div className="border-b border-border/60 px-6 py-4">
          <h2 className="text-lg font-semibold">Send via WhatsApp</h2>
          <p className="text-sm text-muted-foreground">
            Pick a template or write a custom message.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading templates…</p>
          ) : customMode ? (
            <div className="space-y-3">
              <label className="text-sm font-medium" htmlFor="wa-custom-message">
                Custom message
              </label>
              <textarea
                id="wa-custom-message"
                className="min-h-[140px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={customText}
                onChange={(event) => setCustomText(event.target.value)}
                placeholder="Type your message..."
              />
            </div>
          ) : (
            <div className="space-y-3">
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates available.</p>
              ) : (
                templates.map((template) => {
                  const preview = substituteMessageTemplate(template.content, vars);
                  const active = (selectedId ?? templates[0]?.id) === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:border-border"
                      }`}
                      onClick={() => setSelectedId(template.id)}
                    >
                      <p className="font-semibold">{template.name}</p>
                      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{preview}</p>
                    </button>
                  );
                })
              )}

              <button
                type="button"
                className="w-full rounded-xl border border-dashed border-primary/50 px-3 py-3 text-sm font-semibold text-primary hover:bg-primary/5"
                onClick={() => setCustomMode(true)}
              >
                Custom message
              </button>
            </div>
          )}

          {!customMode && previewMessage ? (
            <div className="mt-4 rounded-lg bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Preview
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{previewMessage}</p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 px-6 py-4">
          {customMode ? (
            <Button type="button" variant="outline" onClick={() => setCustomMode(false)}>
              Back
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          <Button type="button" onClick={handleOpenWhatsApp} disabled={!previewMessage.trim()}>
            Open in WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}
