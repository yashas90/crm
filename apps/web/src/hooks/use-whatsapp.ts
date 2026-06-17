"use client";

import { apiGet, apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type WhatsAppTemplate = {
  id: string;
  name: string;
  templateName: string;
  language: string;
  category: "marketing" | "utility" | "authentication";
  variables: string[];
  isActive: boolean;
};

export type WhatsAppMessage = {
  id: string;
  leadId: string;
  templateId: string;
  variables: Record<string, string>;
  waMessageId: string | null;
  status: "sent" | "delivered" | "read" | "failed";
  sentAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  failedReason: string | null;
  template: { id: string; name: string; templateName: string };
  sender: { id: string; name: string } | null;
};

export function useWhatsAppTemplates(options?: { all?: boolean; enabled?: boolean }) {
  const query = options?.all ? "?all=true" : "";

  return useQuery({
    queryKey: ["whatsapp", "templates", options?.all ? "all" : "active"],
    queryFn: () => apiGet<{ items: WhatsAppTemplate[] }>(`/api/whatsapp/templates${query}`),
    enabled: options?.enabled ?? true,
  });
}

export function useSyncWhatsAppTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiPost<{ upserted: number; checked: number }>("/api/whatsapp/templates/sync", {}),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["whatsapp", "templates"] });
      toast.success(`Synced ${data.upserted} template${data.upserted === 1 ? "" : "s"} from Meta.`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Template sync failed.");
    },
  });
}

export function useLeadWhatsAppMessages(leadId: string) {
  return useQuery({
    queryKey: ["whatsapp", "messages", leadId],
    queryFn: () => apiGet<{ items: WhatsAppMessage[] }>(`/api/leads/${leadId}/whatsapp-messages`),
    enabled: Boolean(leadId),
  });
}

export function useSendWhatsAppMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      leadId: string;
      templateId: string;
      variables?: Record<string, string>;
    }) => apiPost<WhatsAppMessage>("/api/whatsapp/send", body),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["whatsapp", "messages", variables.leadId] });
      toast.success("WhatsApp template sent.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send WhatsApp message.");
    },
  });
}

export function variableKeyFromPlaceholder(placeholder: string) {
  return placeholder.replace(/^\{\{|\}\}$/g, "").trim();
}

export function buildDefaultTemplateVariables(lead: {
  firstName: string;
  lastName: string;
  phone: string | null;
  projectName?: string | null;
  city?: string | null;
}) {
  const fullName = `${lead.firstName} ${lead.lastName}`.trim();
  return {
    name: fullName,
    first_name: lead.firstName,
    last_name: lead.lastName,
    phone: lead.phone ?? "",
    property: lead.projectName ?? "",
    project: lead.projectName ?? "",
    city: lead.city ?? "",
  };
}
