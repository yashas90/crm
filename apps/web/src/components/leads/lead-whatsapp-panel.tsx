"use client";

import { useLeadWhatsAppMessages } from "@/hooks/use-whatsapp";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";

type LeadWhatsAppPanelProps = {
  leadId: string;
};

function statusClass(status: string) {
  switch (status) {
    case "read":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "delivered":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "failed":
      return "bg-red-500/15 text-red-700 dark:text-red-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function LeadWhatsAppPanel({ leadId }: LeadWhatsAppPanelProps) {
  const messages = useLeadWhatsAppMessages(leadId);
  const items = messages.data?.items ?? [];

  return (
    <Card className="rounded-xl ">
      <CardHeader>
        <CardTitle className="text-base">WhatsApp messages</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading message history...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No template messages sent yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((message) => (
              <li
                key={message.id}
                className="rounded-lg border border-slate-200/80 bg-muted/15 px-3 py-2 text-sm dark:border-white/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{message.template.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
                      statusClass(message.status),
                    )}
                  >
                    {message.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(message.sentAt).toLocaleString()}
                  {message.sender?.name ? ` · ${message.sender.name}` : ""}
                </p>
                {message.failedReason ? (
                  <p className="mt-1 text-xs text-destructive">{message.failedReason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
