"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSendSms } from "@/hooks/use-sms";
import { Button } from "@propninja/ui/button";
import { Label } from "@propninja/ui/label";
import { useState } from "react";

type SendSmsDialogProps = {
  leadId: string;
  leadName: string;
  phone?: string | null;
  smsConsent?: boolean | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SendSmsDialog({
  leadId,
  leadName,
  phone,
  smsConsent,
  open,
  onOpenChange,
}: SendSmsDialogProps) {
  const [message, setMessage] = useState("");
  const sendSms = useSendSms(leadId);

  const canSend = Boolean(phone) && smsConsent === true;

  async function handleSend() {
    if (!message.trim() || !canSend) return;
    await sendSms.mutateAsync(message.trim());
    setMessage("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send SMS</DialogTitle>
          <DialogDescription>
            Message {leadName}
            {phone ? ` at ${phone}` : ""}. SMS is only sent when TCF consent is granted.
          </DialogDescription>
        </DialogHeader>

        {!phone ? (
          <p className="text-sm text-destructive">This lead has no phone number.</p>
        ) : smsConsent !== true ? (
          <p className="text-sm text-destructive">
            SMS consent is not granted. Update compliance settings before sending.
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="sms-message">Message</Label>
            <textarea
              id="sms-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1600}
              placeholder="Type your SMS message…"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">{message.length}/1600</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canSend || !message.trim() || sendSms.isPending}
            onClick={() => void handleSend()}
          >
            {sendSms.isPending ? "Sending…" : "Send SMS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
