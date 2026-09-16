"use client";

import { useUsersList } from "@/hooks/use-users";
import {
  useReplyWhatsApp,
  useWhatsAppInbox,
  useWhatsAppThread,
} from "@/hooks/use-whatsapp-blaster";
import { apiPost } from "@/lib/apiClient";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { cn } from "@propninja/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function WhatsAppInboxPage() {
  const inbox = useWhatsAppInbox();
  const [selected, setSelected] = useState<string | null>(null);
  const thread = useWhatsAppThread(selected);
  const reply = useReplyWhatsApp();
  const [text, setText] = useState("");
  const users = useUsersList({ page: 1, pageSize: 100 });
  const qc = useQueryClient();
  const items = inbox.data?.items ?? [];

  return (
    <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[320px_1fr]">
      <div className="overflow-auto rounded-xl border border-slate-200/80 dark:border-white/10">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No inbound replies yet.</p>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item.id)}
              className={cn(
                "flex w-full flex-col items-start border-b px-4 py-3 text-left text-sm",
                selected === item.id
                  ? "bg-[#204060]/10"
                  : "hover:bg-slate-50 dark:hover:bg-white/5",
              )}
            >
              <span className="font-semibold">
                {item.name}{" "}
                {item.unreadCount > 0 ? (
                  <span className="ml-1 rounded-full bg-[#C02020] px-1.5 text-[10px] text-white">
                    {item.unreadCount}
                  </span>
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground">{item.phone}</span>
              <span className="text-xs">
                {item.campaignName} · {item.status}
              </span>
            </button>
          ))
        )}
      </div>
      <div className="flex flex-col rounded-xl border border-slate-200/80 dark:border-white/10">
        {selected && thread.data ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b p-3">
              <div>
                <p className="font-semibold">{thread.data.contact.name}</p>
                <p className="text-xs text-muted-foreground">{thread.data.contact.phone}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void apiPost(`/api/whatsapp/blaster/inbox/${selected}/interested`, {}).then(() =>
                    qc.invalidateQueries({ queryKey: ["whatsapp-blaster"] }),
                  )
                }
              >
                Mark Interested
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void apiPost(`/api/whatsapp/blaster/inbox/${selected}/not-interested`, {}).then(
                    () => qc.invalidateQueries({ queryKey: ["whatsapp-blaster"] }),
                  )
                }
              >
                Mark Not Interested
              </Button>
              <select
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-white/10 dark:bg-transparent"
                onChange={(e) => {
                  if (!e.target.value) return;
                  void apiPost(`/api/whatsapp/blaster/inbox/${selected}/assign`, {
                    agentId: e.target.value,
                  }).then(() => qc.invalidateQueries({ queryKey: ["whatsapp-blaster"] }));
                }}
                defaultValue=""
              >
                <option value="">Assign to agent</option>
                {(users.data?.items ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-2 overflow-auto bg-[#ece5dd]/40 p-4">
              {thread.data.items.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[80%] rounded-lg p-2 text-sm whitespace-pre-wrap",
                    msg.direction === "outbound"
                      ? "ml-auto bg-[#dcf8c6]"
                      : "bg-white dark:bg-white/10",
                  )}
                >
                  {msg.content}
                  <p className="mt-1 text-[10px] text-slate-500">
                    {msg.direction} · {msg.status}
                  </p>
                </div>
              ))}
            </div>
            <form
              className="flex gap-2 border-t p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!text.trim()) return;
                void reply.mutateAsync({ contactId: selected, text }).then(() => setText(""));
              }}
            >
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply…" />
              <Button type="submit" disabled={reply.isPending}>
                Send
              </Button>
            </form>
          </>
        ) : (
          <p className="m-auto p-8 text-sm text-muted-foreground">Select a conversation</p>
        )}
      </div>
    </div>
  );
}
