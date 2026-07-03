import { ApiRequestError, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
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
  floor: number;
  bedrooms: number;
  areaSqFt: string;
  status: string;
  priceListedRs: number;
  priceFinalRs: number | null;
  projectId: string;
  projectName: string;
  bookingDocument?: {
    id: string;
    bookingRef: string;
    fileKey: string;
    fileUrl: string;
    generatedAt: string;
  } | null;
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
      toast.success("Template created");
    },
    onError: () => toast.error("Failed to create template"),
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
      toast.success("Template updated");
    },
    onError: () => toast.error("Failed to update template"),
  });
}

export function useDeactivateMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<MessageTemplate>(`/api/message-templates/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["message-templates"] });
      toast.success("Template deactivated");
    },
    onError: () => toast.error("Failed to deactivate template"),
  });
}

export function messageTemplateErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiRequestError ? error.message : fallback;
}
