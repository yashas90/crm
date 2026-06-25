"use client";

import { apiGet, apiPost } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Mail, Send } from "lucide-react";
import { useState } from "react";

type EmailLog = {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  status: string;
  sentAt: string;
};

type LeadEmailPanelProps = {
  leadId: string;
  leadEmail?: string | null;
};

export function LeadEmailPanel({ leadId, leadEmail }: LeadEmailPanelProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(leadEmail ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const logs = useQuery({
    queryKey: ["email-logs", leadId],
    queryFn: () => apiGet<EmailLog[]>(`/api/email/lead/${leadId}`),
    enabled: open,
  });

  const send = useMutation({
    mutationFn: () => apiPost("/api/email/send", { leadId, toEmail: to, subject, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-logs", leadId] });
      setSubject("");
      setBody("");
      toast.success("Email sent");
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to send email")),
  });

  return (
    <Card>
      <CardHeader className="cursor-pointer pb-3" onClick={() => setOpen((v) => !v)}>
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Email
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-lg border p-3">
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line…"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Message</Label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your message…"
                rows={5}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button
              size="sm"
              onClick={() => send.mutate()}
              disabled={send.isPending || !to || !subject || !body}
            >
              <Send className="mr-2 h-3 w-3" />
              {send.isPending ? "Sending…" : "Send email"}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Email history</p>
            {logs.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : !logs.data?.length ? (
              <p className="text-xs text-muted-foreground">No emails sent yet.</p>
            ) : (
              <div className="space-y-2">
                {logs.data.map((log) => (
                  <div key={log.id} className="rounded-md border p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{log.subject}</span>
                      <span
                        className={log.status === "sent" ? "text-emerald-600" : "text-destructive"}
                      >
                        {log.status}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      To: {log.toEmail} · {new Date(log.sentAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
