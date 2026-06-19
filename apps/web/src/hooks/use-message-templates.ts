import { ApiRequestError, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import type { MessageTemplateCategory } from "@propninja/types/message-templates";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type MessageTemplate = {
  id: string;
  name: string;
  content: string;
  category: MessageTemplateCategory;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadLinkedUnit = {
  id: string;
  unitNumber: string;
  floor: number | null;
  bedrooms: number | null;
  areaSqFt: string;
  status: string;
  priceListedRs: string;
  projectId: string;
  projectName: string;
};

export function useMessageTemplates(options?: { all?: boolean; enabled?: boolean }) {
  const query = options?.all ? "?all=true" : "";
  return useQuery({
    queryKey: ["message-templates", options?.all ? "all" : "active"],
    queryFn: () => apiGet<{ items: MessageTemplate[] }>(`/api/message-templates${query}`),
    enabled: options?.enabled ?? true,
  });
}

export function useLeadLinkedUnit(leadId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["leads", leadId, "linked-unit"],
    queryFn: () => apiGet<LeadLinkedUnit | null>(`/api/leads/${leadId}/linked-unit`),
    enabled: Boolean(leadId) && (options?.enabled ?? true),
  });
}

export function useCreateMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; content: string; category: MessageTemplateCategory }) =>
      apiPost<MessageTemplate>("/api/message-templates", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["message-templates"] });
    },
  });
}

export function useUpdateMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      content?: string;
      category?: MessageTemplateCategory;
      isActive?: boolean;
    }) => apiPatch<MessageTemplate>(`/api/message-templates/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["message-templates"] });
    },
  });
}

export function useDeactivateMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<MessageTemplate>(`/api/message-templates/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["message-templates"] });
    },
  });
}

export function messageTemplateErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiRequestError ? error.message : fallback;
}
