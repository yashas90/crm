"use client";

import { apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { useMutation } from "@tanstack/react-query";

export function useSendSms(leadId: string) {
  return useMutation({
    mutationFn: (message: string) =>
      apiPost<{ messageId: string; status: string }>("/api/sms/send", { leadId, message }),
    onSuccess: () => toast.success("SMS sent"),
    onError: (err: Error) => toast.error(err.message),
  });
}
