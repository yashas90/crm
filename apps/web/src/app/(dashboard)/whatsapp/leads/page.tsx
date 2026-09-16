"use client";

import {
  useConvertWhatsAppLead,
  useWhatsAppLead,
  useWhatsAppLeads,
} from "@/hooks/use-whatsapp-blaster";
import { Button } from "@propninja/ui/button";
import { Card, CardContent } from "@propninja/ui/card";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function WhatsAppLeadsPage() {
  const leads = useWhatsAppLeads();
  const convert = useConvertWhatsAppLead();
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const detail = useWhatsAppLead(openId);
  const items = leads.data?.items ?? [];

  const chat = useMemo(() => detail.data?.transcript ?? [], [detail.data]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Separate WhatsApp Leads bucket. Auto-created the instant a contact taps I&apos;m Interested.
      </p>
      <div className="overflow-auto rounded-xl border border-slate-200/80 dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2">Lead ID</th>
              <th className="px-3 py-2">Name + phone</th>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Answers</th>
              <th className="px-3 py-2">Interest</th>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={7}>
                  No WhatsApp leads yet.
                </td>
              </tr>
            ) : (
              items.map((lead) => (
                <tr key={lead.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{lead.leadCode}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{lead.name}</div>
                    <div className="text-xs text-muted-foreground">{lead.contactPhone}</div>
                  </td>
                  <td className="px-3 py-2">{lead.sourceCampaign}</td>
                  <td className="px-3 py-2 text-xs">
                    {[lead.budgetAnswer, lead.locationAnswer, lead.timelineAnswer]
                      .filter(Boolean)
                      .join(" · ") || "Pending questions"}
                  </td>
                  <td className="px-3 py-2 text-xs">{timeAgo(lead.interestAt)}</td>
                  <td className="px-3 py-2 text-xs">{lead.assignedAgentName ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" asChild>
                        <a href={`tel:${lead.contactPhone}`}>Call Now</a>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setOpenId(lead.id)}>
                        View Chat
                      </Button>
                      <Button
                        size="sm"
                        disabled={Boolean(lead.convertedToLeadId) || convert.isPending}
                        onClick={() =>
                          void convert.mutateAsync(lead.id).then((res) => {
                            router.push(`/leads/${res.leadId}`);
                          })
                        }
                      >
                        Convert to Full Lead
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {openId ? (
        <Card>
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Chat transcript</p>
              <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>
                Close
              </Button>
            </div>
            {chat.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages stored yet.</p>
            ) : (
              chat.map((msg) => (
                <div key={msg.id} className="rounded-lg border px-3 py-2 text-sm">
                  <span className="text-xs uppercase text-slate-400">{msg.direction}</span>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
